#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  FERREPRO - PANEL VISUAL DEL SCRAPER (GUI)
===============================================================================
Interfaz gráfica sencilla y moderna para ejecutar el scraper con 1 clic.
===============================================================================
"""

import sys
import os
import threading
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

# Importar lógica del scraper
try:
    from scraper import scrapear_url, exportar_archivos
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from scraper import scrapear_url, exportar_archivos

class ScraperGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("FerrePro — Extractor de Productos Web")
        self.geometry("640x580")
        self.minsize(560, 500)
        self.configure(bg="#0f1320")

        self.last_csv = None
        self.last_xlsx = None
        self.is_running = False

        self.setup_ui()

    def setup_ui(self):
        # Estilos
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure(".", background="#0f1320", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("TLabel", background="#0f1320", foreground="#f8fafc")
        style.configure("Header.TLabel", font=("Segoe UI", 16, "bold"), foreground="#f97316")
        style.configure("Muted.TLabel", font=("Segoe UI", 9), foreground="#8896a7")
        style.configure("TEntry", fieldbackground="#161c2e", foreground="#f8fafc", insertcolor="#f8fafc")
        style.configure("TCombobox", fieldbackground="#161c2e", foreground="#f8fafc")

        # Contenedor principal
        main_frame = tk.Frame(self, bg="#0f1320", padx=24, pady=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Encabezado
        header_frame = tk.Frame(main_frame, bg="#0f1320")
        header_frame.pack(fill=tk.X, pady=(0, 16))

        tk.Label(header_frame, text="🔧 FerrePro Scraper", font=("Segoe UI", 16, "bold"), bg="#0f1320", fg="#f97316").pack(anchor="w")
        tk.Label(header_frame, text="Extraé productos desde cualquier tienda web y generá un CSV listo para importar", font=("Segoe UI", 9), bg="#0f1320", fg="#8896a7").pack(anchor="w", pady=(2, 0))

        # Tarjeta de configuración
        card = tk.Frame(main_frame, bg="#161c2e", bd=1, relief="solid", padx=16, pady=16)
        card.pack(fill=tk.X, pady=(0, 14))

        # 1. URL
        tk.Label(card, text="URL del catálogo o categoría:", font=("Segoe UI", 10, "bold"), bg="#161c2e", fg="#e2e8f0").pack(anchor="w", pady=(0, 4))
        self.url_var = tk.StringVar(value="")
        url_entry = tk.Entry(card, textvariable=self.url_var, bg="#0f1320", fg="#f8fafc", insertbackground="#fff", bd=1, relief="solid", font=("Segoe UI", 10))
        url_entry.pack(fill=tk.X, pady=(0, 12), ipady=4)
        url_entry.focus()

        # Grid de 3 opciones (Páginas, Margen, Proveedor)
        opts_frame = tk.Frame(card, bg="#161c2e")
        opts_frame.pack(fill=tk.X)

        # Páginas
        p_col = tk.Frame(opts_frame, bg="#161c2e")
        p_col.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        tk.Label(p_col, text="Máx. páginas:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7").pack(anchor="w")
        self.pages_var = tk.StringVar(value="3")
        tk.Spinbox(p_col, from_=1, to=50, textvariable=self.pages_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10), width=6).pack(fill=tk.X, pady=(3, 0), ipady=2)

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
        tk.Label(main_frame, text="Progreso y registro:", font=("Segoe UI", 9, "bold"), bg="#0f1320", fg="#8896a7").pack(anchor="w", pady=(0, 4))
        
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

        self.btn_open_csv = tk.Button(self.res_frame, text="📄 Abrir CSV en Excel", font=("Segoe UI", 9, "bold"), bg="#22c55e", fg="#ffffff", bd=0, cursor="hand2", padx=12, pady=6, command=self.open_csv, state=tk.DISABLED)
        self.btn_open_csv.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_open_folder = tk.Button(self.res_frame, text="📁 Abrir Carpeta de Guardado", font=("Segoe UI", 9), bg="#1e293b", fg="#e2e8f0", bd=1, relief="solid", cursor="hand2", padx=12, pady=6, command=self.open_folder)
        self.btn_open_folder.pack(side=tk.LEFT)

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
            pages = int(self.pages_var.get())
        except ValueError:
            pages = 3

        try:
            margin = float(self.margin_var.get().replace(',', '.'))
        except ValueError:
            margin = 50.0

        prov = self.prov_var.get().strip() or "Distribuidor Web"

        self.btn_run.config(state=tk.DISABLED, text="⏳ EXRAYENDO PRODUCTOS...")
        self.btn_open_csv.config(state=tk.DISABLED)
        self.log_text.delete("1.0", tk.END)

        # Ejecutar en hilo secundario para no congelar la ventana
        threading.Thread(target=self._run_thread, args=(url, pages, prov, margin), daemon=True).start()

    def _run_thread(self, url, pages, prov, margin):
        self.log(f"▶ Conectando a {url}...")
        self.log(f"▶ Máx. páginas: {pages} | Margen: {margin}% | Proveedor: {prov}")
        self.log("-" * 55)

        try:
            productos = scrapear_url(url, max_paginas=pages, proveedor=prov, margen_ganancia=margin)
            
            if not productos:
                self.log("⚠️ No se encontraron productos. Verificá si la página tiene protección Cloudflare o estructura privada.")
                messagebox.showwarning("Sin resultados", "No se detectaron productos en la URL provista.")
            else:
                timestamp = Path.cwd() / "scraper" / f"productos_{pages}pag"
                csv_path, xlsx_path = exportar_archivos(productos, ruta_salida_base=str(timestamp))
                self.last_csv = csv_path
                self.last_xlsx = xlsx_path

                self.log("-" * 55)
                self.log(f"🎉 ¡Extracción completada! Se guardaron {len(productos)} productos.")
                self.log(f"📁 CSV listo: {csv_path}")
                self.btn_open_csv.config(state=tk.NORMAL)
                messagebox.showinfo("Éxito", f"¡Extracción exitosa!\n\nSe extrajeron {len(productos)} productos y se guardaron en CSV.\n\nYa podés importarlos en FerrePro.")

        except Exception as e:
            self.log(f"❌ Ocurrió un error: {e}")
            messagebox.showerror("Error", f"Error durante la extracción:\n{e}")
        finally:
            self.btn_run.config(state=tk.NORMAL, text="🚀 INICIAR EXTRACCIÓN")

    def open_csv(self):
        if self.last_csv and os.path.exists(self.last_csv):
            os.startfile(self.last_csv)

    def open_folder(self):
        folder = Path.cwd() / "scraper"
        folder.mkdir(exist_ok=True)
        os.startfile(folder)

if __name__ == "__main__":
    app = ScraperGUI()
    app.mainloop()