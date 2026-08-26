#!/usr/bin/env python3
"""
PriceScraper — Servidor HTTP
API REST para uso desde cualquier app.

Endpoints:
  POST /api/scrape          scrape URL o subir archivo
  GET  /api/export/csv      descargar último resultado como CSV
  GET  /api/export/excel    descargar último resultado como Excel
  GET  /api/status          estado del servidor
  GET  /                    interfaz web
"""

import json
import os
import io
import re
import tempfile
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

from scraper import scrape, export_csv, export_excel


def _parse_multipart(data: bytes, boundary: bytes):
    """Parser multipart/form-data sin depender del módulo cgi (removido en Py 3.13)."""
    parts = {}
    delimiter = b"--" + boundary
    segments = data.split(delimiter)
    for seg in segments:
        if seg in (b"", b"--", b"--\r\n", b"\r\n"):
            continue
        # Separar cabeceras del cuerpo
        if b"\r\n\r\n" in seg:
            head_raw, body = seg.split(b"\r\n\r\n", 1)
        elif b"\n\n" in seg:
            head_raw, body = seg.split(b"\n\n", 1)
        else:
            continue
        # Quitar trailing --\r\n del último segmento
        body = body.rstrip(b"\r\n").rstrip(b"--").rstrip(b"\r\n")
        heads = head_raw.decode("utf-8", errors="replace")
        # Extraer name y filename
        name_m     = re.search(r'name="([^"]+)"',     heads)
        filename_m = re.search(r'filename="([^"]*)"', heads)
        if not name_m:
            continue
        name     = name_m.group(1)
        filename = filename_m.group(1) if filename_m else None
        parts[name] = {"value": body, "filename": filename}
    return parts

PORT = 7700
HOST = "0.0.0.0"

# Estado compartido (thread-safe con lock)
_lock = threading.Lock()
_state = {
    "last_items":  [],
    "last_source": "",
    "last_time":   None,
    "jobs":        [],   # historial de trabajos
}


def _json(data) -> bytes:
    return json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")


def _cors(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


class ScraperHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        status = str(args[1]) if len(args) > 1 else "?"
        path   = str(args[0]).split()[1] if args else ""
        color  = "\033[32m" if status.startswith("2") else "\033[33m" if status.startswith("3") else "\033[31m"
        print(f"  {color}{status}\033[0m  {path}")

    def do_OPTIONS(self):
        self.send_response(200)
        _cors(self)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/":
            self._serve_index()

        elif path == "/api/status":
            with _lock:
                data = {
                    "ok":        True,
                    "items":     len(_state["last_items"]),
                    "source":    _state["last_source"],
                    "timestamp": _state["last_time"],
                    "jobs":      _state["jobs"][-10:],
                }
            self._ok(_json(data), "application/json")

        elif path == "/api/export/csv":
            with _lock:
                items = list(_state["last_items"])
            if not items:
                self._err(404, "Sin datos. Ejecutá un scrape primero.")
                return
            buf = io.StringIO()
            import csv
            keys = list(items[0].keys())
            writer = csv.DictWriter(buf, fieldnames=keys, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(items)
            fname = f"precios_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
            self._download(buf.getvalue().encode("utf-8-sig"), "text/csv", fname)

        elif path == "/api/export/excel":
            with _lock:
                items = list(_state["last_items"])
            if not items:
                self._err(404, "Sin datos. Ejecutá un scrape primero.")
                return
            with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                tmp_path = tmp.name
            export_excel(items, tmp_path)
            with open(tmp_path, "rb") as f:
                data = f.read()
            os.unlink(tmp_path)
            fname = f"precios_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
            self._download(data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fname)

        else:
            self._err(404, "Ruta no encontrada")

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/scrape":
            ct = self.headers.get("Content-Type", "")

            # ── JSON body (URL) ──────────────────────────────────────
            if "application/json" in ct:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))
                url  = body.get("url", "").strip()
                stype = body.get("type", "auto")
                use_scroll = body.get("scroll", False)  # Nuevo: parámetro para scroll infinito
                if not url:
                    self._err(400, "Falta el campo 'url'")
                    return
                self._run_scrape(url, stype, use_scroll=use_scroll)

            # ── Multipart (file upload) ──────────────────────────────
            elif "multipart/form-data" in ct:
                length = int(self.headers.get("Content-Length", 0))
                raw_data = self.rfile.read(length)

                # Extraer boundary
                bnd_m = re.search(r"boundary=([^;\r\n]+)", ct)
                if not bnd_m:
                    self._err(400, "Multipart boundary no encontrado")
                    return
                boundary = bnd_m.group(1).strip().encode()

                parts = _parse_multipart(raw_data, boundary)
                file_part = parts.get("file")
                type_part = parts.get("type")
                stype     = type_part["value"].decode("utf-8", errors="replace").strip() if type_part else "auto"

                if not file_part or not file_part.get("filename"):
                    self._err(400, "No se recibió un archivo válido")
                    return

                filename = file_part["filename"] or "upload"
                file_data = file_part["value"]

                suffix = Path(filename).suffix or ".bin"
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(file_data)
                    tmp_path = tmp.name

                try:
                    self._run_scrape(tmp_path, stype, display_name=filename)
                finally:
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass

            else:
                self._err(415, f"Content-Type no soportado: {ct}")

        else:
            self._err(404, "Ruta no encontrada")

    # ── helpers ─────────────────────────────────────────────────────

    def _run_scrape(self, source: str, stype: str, display_name: str = "", use_scroll: bool = False):
        try:
            items = scrape(source, stype, use_scroll=use_scroll)
            label = display_name or source
            job = {
                "source":    label,
                "type":      stype,
                "items":     len(items),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "ok":        True,
            }
        except Exception as e:
            items = []
            job = {
                "source":    display_name or source,
                "type":      stype,
                "items":     0,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "ok":        False,
                "error":     str(e),
            }

        with _lock:
            _state["last_items"]  = items
            _state["last_source"] = display_name or source
            _state["last_time"]   = datetime.now().isoformat()
            _state["jobs"].append(job)

        result = {
            "ok":      job["ok"],
            "source":  job["source"],
            "items":   len(items),
            "preview": items,  # todos los items
        }
        if not job["ok"]:
            result["error"] = job.get("error", "Error desconocido")

        self._ok(_json(result), "application/json")

    def _ok(self, body: bytes, ct: str):
        self.send_response(200)
        self.send_header("Content-Type", ct + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        _cors(self)
        self.end_headers()
        self.wfile.write(body)

    def _download(self, body: bytes, ct: str, filename: str):
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        _cors(self)
        self.end_headers()
        self.wfile.write(body)

    def _err(self, code: int, msg: str):
        body = _json({"ok": False, "error": msg})
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        _cors(self)
        self.end_headers()
        self.wfile.write(body)

    def _serve_index(self):
        html_path = next((Path(__file__).parent / n for n in ["index.html","index_scraper.html"] if (Path(__file__).parent / n).exists()), None)
        if html_path and html_path.exists():
            body = html_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self._err(404, "index.html no encontrado")


def main():
    import socket
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    server = HTTPServer((HOST, PORT), ScraperHandler)
    print()
    print("  \033[1m\033[33m⚡ PriceScraper — Servidor HTTP\033[0m")
    print(f"  \033[36mLocal:   http://localhost:{PORT}\033[0m")
    print(f"  \033[36mRed:     http://{ip}:{PORT}\033[0m")
    print()
    print("  Endpoints:")
    print(f"    POST http://localhost:{PORT}/api/scrape          ← scrape URL o archivo")
    print(f"    GET  http://localhost:{PORT}/api/export/csv      ← descargar CSV")
    print(f"    GET  http://localhost:{PORT}/api/export/excel    ← descargar Excel")
    print(f"    GET  http://localhost:{PORT}/api/status          ← estado")
    print()
    print("  \033[90mCtrl+C para detener\033[0m")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor detenido.")


if __name__ == "__main__":
    main()
