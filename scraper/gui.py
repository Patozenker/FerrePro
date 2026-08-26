#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  FERREPRO - PANEL VISUAL DEL SCRAPER (GUI CON SCROLL INFINITO)
===============================================================================
Interfaz gráfica moderna para extraer productos con paginación tradicional
o scroll infinito / JavaScript en 1 solo clic.
===============================================================================
"""

import sys
import os
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

try:
    from scraper import scrapear_url, scrapear_scroll_infinito, exportar_archivos, PLAYWRIGHT_AVAILABLE
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from scraper import scrapear_url, scrapear_scroll_infinito, exportar_archivos, PLAYWRIGHT_AVAILABLE

class ScraperGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("FerrePro — Extractor de Productos Web")
        self.geometry("680x640")
        self.minsize(580, 540)
        self.configure(bg="#0f1320")

        self.last_csv = None
        self.last_xlsx = None
        self.is_running = False

        self.setup_ui()

    def setup_ui(self):
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure(".", background="#0f1320", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("TLabel", background="#0f1320", foreground="#f8fafc")
        style.configure("TCheckbutton", background="#161c2e", foreground="#f8fafc", font=("Segoe UI", 10))

        main_frame = tk.Frame(self, bg="#0f1320", padx=24, pady=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Encabezado
        header_frame = tk.Frame(main_frame, bg="#0f1320")
        header_frame.pack(fill=tk.X, pady=(0, 16))

        tk.Label(header_frame, text="🔧 FerrePro Scraper Universal", font=("Segoe UI", 16, "bold"), bg="#0f1320", fg="#f97316").pack(anchor="w")
        tk.Label(header_frame, text="Extraé productos desde cualquier tienda web (Paginación o Scroll Infinito) y generá un CSV listo para FerrePro", font=("Segoe UI", 9), bg="#0f1320", fg="#8896a7").pack(anchor="w", pady=(2, 0))

        # Tarjeta de configuración
        card = tk.Frame(main_frame, bg="#161c2e", bd=1, relief="solid", padx=16, pady=16)
        card.pack(fill=tk.X, pady=(0, 14))

        # 1. URL
        tk.Label(card, text="URL del catálogo o categoría:", font=("Segoe UI", 10, "bold"), bg="#161c2e", fg="#e2e8f0").pack(anchor="w", pady=(0, 4))
        self.url_var = tk.StringVar(value="")
        url_entry = tk.Entry(card, textvariable=self.url_var, bg="#0f1320", fg="#f8fafc", insertbackground="#fff", bd=1, relief="solid", font=("Segoe UI", 10))
        url_entry.pack(fill=tk.X, pady=(0, 12), ipady=4)
        url_entry.focus()

        # Checkbox de Scroll Infinito
        self.scroll_var = tk.BooleanVar(value=True)
        cb_frame = tk.Frame(card, bg="#161c2e")
        cb_frame.pack(fill=tk.X, pady=(0, 12))
        
        cb = tk.Checkbutton(cb_frame, text="⚡ Activar modo Scroll Infinito / Carga dinámica (JavaScript)", variable=self.scroll_var, bg="#161c2e", fg="#38bdf8", activebackground="#161c2e", activeforeground="#38bdf8", selectcolor="#0f1320", font=("Segoe UI", 10, "bold"), command=self.toggle_mode)
        cb.pack(anchor="w")

        # Grid de 3 opciones (Límite, Margen, Proveedor)
        opts_frame = tk.Frame(card, bg="#161c2e")
        opts_frame.pack(fill=tk.X)

        # Límite (Scrolls o Páginas)
        self.limit_frame = tk.Frame(opts_frame, bg="#161c2e")
        self.limit_frame.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        self.limit_label = tk.Label(self.limit_frame, text="Máx. Scrolls:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7")
        self.limit_label.pack(anchor="w")
        self.limit_var = tk.StringVar(value="15")
        self.limit_spin = tk.Spinbox(self.limit_frame, from_=1, to=100, textvariable=self.limit_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10), width=6)
        self.limit_spin.pack(fill=tk.X, pady=(3, 0), ipady=2)

        # Margen
        m_col = tk.Frame(opts_frame, bg="#161c2e")
        m_col.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=6)
        tk.Label(m_col, text="Margen venta %:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7").pack(anchor="w")
        self.margin_var = tk.StringVar(value="50")
        tk.Entry(m_col, textvariable=self.margin_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10), width=8).pack(fill=tk.X, pady=(3, 0), ipady=2)

        # Proveedor
        pr_col = tk.Frame(opts_frame, bg="#161c2e")
        pr_col.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(6, 0))
        tk.Label(pr_col, text="Proveedor:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7").pack(anchor="w")
        self.prov_var = tk.StringVar(value="Distribuidor Web")
        tk.Entry(pr_col, textvariable=self.prov_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10)).pack(fill=tk.X, pady=(3, 0), ipady=2)

        # Botón de acción principal
        self.btn_run = tk.Button(main_frame, text="🚀 INICIAR EXTRACCIÓN", font=("Segoe UI", 11, "bold"), bg="#f97316", fg="#ffffff", activebackground="#ea6c00", activeforeground="#ffffff", bd=0, cursor="hand2", padx=16, pady=10, command=self.start_scraping)
        self.btn_run.pack(fill=tk.X, pady=(0, 14))

        # Consola / Log de salida
        tk.Label(main_frame, text="Progreso en vivo:", font=("Segoe UI", 9, "bold"), bg="#0f1320", fg="#8896a7").pack(anchor="w", pady=(0, 4))
        
        log_frame = tk.Frame(main_frame, bg="#080b12", bd=1, relief="solid")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 12))

        self.log_text = tk.Text(log_frame, bg="#080b12", fg="#38bdf8", insertbackground="#fff", bd=0, font=("Consolas", 9), wrap="word")
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=8, pady=8)
        
        scrollbar = tk.Scrollbar(log_frame, command=self.log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=scrollbar.set)

        # Barra de botones de resultado (Abrir CSV / Abrir Carpeta)
        self.res_frame = tk.Frame(main_frame, bg="#0f1320")
        self.res_frame.pack(fill=tk.X)

        self.btn_open_csv = tk.Button(self.res_frame, text="📄 Abrir CSV generado", font=("Segoe UI", 9, "bold"), bg="#22c55e", fg="#ffffff", bd=0, cursor="hand2", padx=12, pady=6, command=self.open_csv, state=tk.DISABLED)
        self.btn_open_csv.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_open_folder = tk.Button(self.res_frame, text="📁 Abrir Carpeta de Guardado", font=("Segoe UI", 9), bg="#1e293b", fg="#e2e8f0", bd=1, relief="solid", cursor="hand2", padx=12, pady=6, command=self.open_folder)
        self.btn_open_folder.pack(side=tk.LEFT)

    def toggle_mode(self):
        if self.scroll_var.get():
            self.limit_label.config(text="Máx. Scrolls:")
            if self.limit_var.get() in ["3", "5"]:
                self.limit_var.set("15")
        else:
            self.limit_label.config(text="Máx. Páginas:")
            if self.limit_var.get() in ["15", "20"]:
                self.limit_var.set("3")

    def log(self, msg):
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.update_idletasks()

    def start_scraping(self):
        url = self.url_var.get().strip()
        if not url:
            messagebox.showwarning("Atención", "Por favor ingresá la URL del sitio web a scrapear.")
            return

        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
            self.url_var.set(url)

        try:
            limit = int(self.limit_var.get())
        except ValueError:
            limit = 15 if self.scroll_var.get() else 3

        try:
            margin = float(self.margin_var.get().replace(',', '.'))
        except ValueError:
            margin = 50.0

        prov = self.prov_var.get().strip() or "Distribuidor Web"
        use_scroll = self.scroll_var.get()

        self.btn_run.config(state=tk.DISABLED, text="⏳ EXTRAYENDO PRODUCTOS...")
        self.btn_open_csv.config(state=tk.DISABLED)
        self.log_text.delete("1.0", tk.END)

        threading.Thread(target=self._run_thread, args=(url, limit, prov, margin, use_scroll), daemon=True).start()

    def _run_thread(self, url, limit, prov, margin, use_scroll):
        mode_str = "Scroll Infinito (Playwright)" if use_scroll else "Paginación Tradicional"
        self.log(f"▶ Modo: {mode_str}")
        self.log(f"▶ Conectando a {url}...")
        self.log(f"▶ Límite: {limit} | Margen: {margin}% | Proveedor: {prov}")
        self.log("-" * 55)

        try:
            if use_scroll:
                productos = scrapear_scroll_infinito(url, max_scrolls=limit, proveedor=prov, margen_ganancia=margin, callback_log=self.log)
            else:
                productos = scrapear_url(url, max_paginas=limit, proveedor=prov, margen_ganancia=margin, callback_log=self.log)
                if len(productos) == 0 and PLAYWRIGHT_AVAILABLE:
                    self.log("[!] No se detectaron productos estáticos. Reintentando con Scroll Infinito...")
                    productos = scrapear_scroll_infinito(url, max_scrolls=12, proveedor=prov, margen_ganancia=margin, callback_log=self.log)

            if not productos:
                self.log("⚠️ No se encontraron productos en la URL provista.")
                messagebox.showwarning("Sin resultados", "No se detectaron productos. Verificá si la página requiere inicio de sesión o tiene protección anti-bot.")
            else:
                base_dir = Path(__file__).resolve().parent
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_base = base_dir / f"productos_{timestamp}"
                
                csv_path, xlsx_path = exportar_archivos(productos, ruta_salida_base=str(output_base))
                self.last_csv = csv_path
                self.last_xlsx = xlsx_path

                self.log("-" * 55)
                self.log(f"🎉 ¡Extracción completada! Se guardaron {len(productos)} productos.")
                self.log(f"📁 CSV listo: {csv_path}")
                self.btn_open_csv.config(state=tk.NORMAL)
                messagebox.showinfo("Éxito", f"¡Extracción exitosa!\n\nSe extrajeron {len(productos)} productos.\n\nYa podés importarlos en FerrePro.")

        except Exception as e:
            self.log(f"❌ Error durante la extracción: {e}")
            messagebox.showerror("Error", f"Ocurrió un error:\n{e}")
        finally:
            self.btn_run.config(state=tk.NORMAL, text="🚀 INICIAR EXTRACCIÓN")

    def open_csv(self):
        if self.last_csv and os.path.exists(self.last_csv):
            os.startfile(self.last_csv)

    def open_folder(self):
        base_dir = Path(__file__).resolve().parent
        os.startfile(base_dir)

if __name__ == "__main__":
    app = ScraperGUI()
    app.mainloop()