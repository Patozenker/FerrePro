#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  FERREPRO - PANEL DE CONTROL DEL SCRAPER (GESTOR DE PROVEEDORES Y SECCIONES)
===============================================================================
- Almacena el registro persistente de todos los proveedores y sus secciones/carpetas.
- Permite seleccionar mediante checkboxes qué secciones de qué proveedores scrapear.
- Permite scrapear un proveedor individual o todo el ecosistema con un solo clic.
- Genera un archivo CSV consolidado listo para importar en FerrePro.
===============================================================================
"""

import sys
import os
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog

try:
    from scraper import (
        scrapear_url,
        scrapear_scroll_infinito,
        scrapear_sitio_completo,
        scrapear_secciones_proveedor,
        descubrir_categorias,
        cargar_proveedores_config,
        guardar_proveedores_config,
        registrar_o_actualizar_proveedor,
        exportar_archivos,
        PLAYWRIGHT_AVAILABLE
    )
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from scraper import (
        scrapear_url,
        scrapear_scroll_infinito,
        scrapear_sitio_completo,
        scrapear_secciones_proveedor,
        descubrir_categorias,
        cargar_proveedores_config,
        guardar_proveedores_config,
        registrar_o_actualizar_proveedor,
        exportar_archivos,
        PLAYWRIGHT_AVAILABLE
    )

class ScraperGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("FerrePro — Gestor de Proveedores y Scraper Universal")
        self.geometry("900x750")
        self.minsize(800, 650)
        self.configure(bg="#0f1320")

        self.last_csv = None
        self.last_xlsx = None
        self.config_data = cargar_proveedores_config()
        self.selected_prov_id = None
        self.cat_vars = {} # { url: BooleanVar }

        self.setup_ui()
        self.load_proveedores_list()

    def setup_ui(self):
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure(".", background="#0f1320", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("TNotebook", background="#0f1320", borderwidth=0)
        style.configure("TNotebook.Tab", background="#161c2e", foreground="#94a3b8", padding=[14, 8], font=("Segoe UI", 10, "bold"))
        style.map("TNotebook.Tab", background=[("selected", "#1e293b")], foreground=[("selected", "#38bdf8")])
        style.configure("TLabel", background="#0f1320", foreground="#f8fafc")

        main_frame = tk.Frame(self, bg="#0f1320", padx=16, pady=12)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Encabezado
        header_frame = tk.Frame(main_frame, bg="#0f1320")
        header_frame.pack(fill=tk.X, pady=(0, 10))

        tk.Label(header_frame, text="🔧 FerrePro — Gestor de Proveedores y Catálogos", font=("Segoe UI", 15, "bold"), bg="#0f1320", fg="#f97316").pack(anchor="w")
        tk.Label(header_frame, text="Elegí las secciones de cada distribuidor con un check y extraé listas de precios completas", font=("Segoe UI", 9), bg="#0f1320", fg="#8896a7").pack(anchor="w", pady=(2, 0))

        # Notebook (Pestañas)
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        self.tab_guardados = tk.Frame(self.notebook, bg="#0f1320", padx=10, pady=10)
        self.tab_rapido = tk.Frame(self.notebook, bg="#0f1320", padx=10, pady=10)

        self.notebook.add(self.tab_guardados, text="🗂️ Proveedores y Secciones Guardadas")
        self.notebook.add(self.tab_rapido, text="⚡ Extractor Rápido por URL")

        self.build_tab_guardados()
        self.build_tab_rapido()

        # Consola / Log de salida inferior
        log_frame_top = tk.Frame(main_frame, bg="#0f1320")
        log_frame_top.pack(fill=tk.X, pady=(0, 2))
        tk.Label(log_frame_top, text="Progreso y registro en tiempo real:", font=("Segoe UI", 9, "bold"), bg="#0f1320", fg="#8896a7").pack(side=tk.LEFT)

        log_frame = tk.Frame(main_frame, bg="#080b12", bd=1, relief="solid")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 8))

        self.log_text = tk.Text(log_frame, bg="#080b12", fg="#38bdf8", insertbackground="#fff", bd=0, font=("Consolas", 9), wrap="word", height=7)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=6, pady=6)
        
        scrollbar = tk.Scrollbar(log_frame, command=self.log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=scrollbar.set)

        # Barra de botones finales
        bottom_bar = tk.Frame(main_frame, bg="#0f1320")
        bottom_bar.pack(fill=tk.X)

        self.btn_open_csv = tk.Button(bottom_bar, text="📄 Abrir CSV generado", font=("Segoe UI", 9, "bold"), bg="#22c55e", fg="#ffffff", bd=0, cursor="hand2", padx=12, pady=6, command=self.open_csv, state=tk.DISABLED)
        self.btn_open_csv.pack(side=tk.LEFT, padx=(0, 8))

        self.btn_open_folder = tk.Button(bottom_bar, text="📁 Abrir Carpeta de Guardado", font=("Segoe UI", 9), bg="#1e293b", fg="#e2e8f0", bd=1, relief="solid", cursor="hand2", padx=12, pady=6, command=self.open_folder)
        self.btn_open_folder.pack(side=tk.LEFT)

    # ─────────────────────────────────────────────────────────────────────────
    # PESTAÑA 1: GESTOR DE PROVEEDORES Y SECCIONES GUARDADAS
    # ─────────────────────────────────────────────────────────────────────────
    def build_tab_guardados(self):
        paned = tk.PanedWindow(self.tab_guardados, orient=tk.HORIZONTAL, bg="#0f1320", bd=0, sashwidth=4)
        paned.pack(fill=tk.BOTH, expand=True)

        # Panel Izquierdo: Lista de Proveedores
        left_panel = tk.Frame(paned, bg="#161c2e", bd=1, relief="solid", padx=10, pady=10)
        paned.add(left_panel, width=280)

        tk.Label(left_panel, text="Proveedores Registrados", font=("Segoe UI", 10, "bold"), bg="#161c2e", fg="#f97316").pack(anchor="w", pady=(0, 6))

        # Lista de proveedores
        prov_list_frame = tk.Frame(left_panel, bg="#0f1320", bd=1, relief="solid")
        prov_list_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 8))

        self.prov_listbox = tk.Listbox(prov_list_frame, bg="#0f1320", fg="#f8fafc", selectbackground="#1e293b", selectforeground="#38bdf8", bd=0, font=("Segoe UI", 10), activestyle="none")
        self.prov_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4, pady=4)
        self.prov_listbox.bind("<<ListboxSelect>>", self.on_select_proveedor)

        # Botones de gestión de proveedores
        prov_btns = tk.Frame(left_panel, bg="#161c2e")
        prov_btns.pack(fill=tk.X)

        tk.Button(prov_btns, text="➕ Agregar Proveedor", font=("Segoe UI", 9, "bold"), bg="#f97316", fg="#fff", bd=0, cursor="hand2", pady=4, command=self.dialog_nuevo_proveedor).pack(fill=tk.X, pady=(0, 4))
        
        btn_row = tk.Frame(prov_btns, bg="#161c2e")
        btn_row.pack(fill=tk.X)
        tk.Button(btn_row, text="🔄 Re-escanear", font=("Segoe UI", 8), bg="#1e293b", fg="#38bdf8", bd=1, relief="solid", cursor="hand2", command=self.rescan_selected_proveedor).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 2))
        tk.Button(btn_row, text="🗑️ Eliminar", font=("Segoe UI", 8), bg="#1e293b", fg="#ef4444", bd=1, relief="solid", cursor="hand2", command=self.delete_selected_proveedor).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(2, 0))

        # Panel Derecho: Secciones y Checkboxes
        right_panel = tk.Frame(paned, bg="#161c2e", bd=1, relief="solid", padx=12, pady=10)
        paned.add(right_panel)

        # Encabezado del proveedor seleccionado
        self.lbl_selected_title = tk.Label(right_panel, text="Seleccioná un proveedor de la lista", font=("Segoe UI", 11, "bold"), bg="#161c2e", fg="#38bdf8")
        self.lbl_selected_title.pack(anchor="w")

        self.lbl_selected_info = tk.Label(right_panel, text="URL: — | Última extracción: —", font=("Segoe UI", 8), bg="#161c2e", fg="#8896a7")
        self.lbl_selected_info.pack(anchor="w", pady=(0, 8))

        # Botones de selección masiva de checks
        check_tools = tk.Frame(right_panel, bg="#161c2e")
        check_tools.pack(fill=tk.X, pady=(0, 6))

        tk.Button(check_tools, text="[✓] Marcar Todas", font=("Segoe UI", 8), bg="#0f1320", fg="#38bdf8", bd=1, relief="solid", cursor="hand2", padx=6, command=self.check_all_cats).pack(side=tk.LEFT, padx=(0, 6))
        tk.Button(check_tools, text="[ ] Desmarcar Todas", font=("Segoe UI", 8), bg="#0f1320", fg="#94a3b8", bd=1, relief="solid", cursor="hand2", padx=6, command=self.uncheck_all_cats).pack(side=tk.LEFT, padx=(0, 6))
        
        self.lbl_check_count = tk.Label(check_tools, text="0 secciones activas", font=("Segoe UI", 9), bg="#161c2e", fg="#8896a7")
        self.lbl_check_count.pack(side=tk.RIGHT)

        # Contenedor scrollable para la lista de categorías con checkboxes
        cat_scroll_frame = tk.Frame(right_panel, bg="#0f1320", bd=1, relief="solid")
        cat_scroll_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        self.cat_canvas = tk.Canvas(cat_scroll_frame, bg="#0f1320", bd=0, highlightthickness=0)
        self.cat_scrollbar = tk.Scrollbar(cat_scroll_frame, orient="vertical", command=self.cat_canvas.yview)
        self.cat_inner_frame = tk.Frame(self.cat_canvas, bg="#0f1320")

        self.cat_inner_frame.bind("<Configure>", lambda e: self.cat_canvas.configure(scrollregion=self.cat_canvas.bbox("all")))
        self.cat_canvas.create_window((0, 0), window=self.cat_inner_frame, anchor="nw")
        self.cat_canvas.configure(yscrollcommand=self.cat_scrollbar.set)

        self.cat_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4, pady=4)
        self.cat_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Botones de ejecución
        exec_box = tk.Frame(right_panel, bg="#161c2e")
        exec_box.pack(fill=tk.X)

        self.btn_scrape_selected = tk.Button(exec_box, text="🚀 Scrapear Secciones Seleccionadas de este Proveedor", font=("Segoe UI", 10, "bold"), bg="#f97316", fg="#fff", bd=0, cursor="hand2", pady=8, command=self.start_scraping_selected_prov)
        self.btn_scrape_selected.pack(fill=tk.X, pady=(0, 4))

        self.btn_scrape_all_provs = tk.Button(exec_box, text="🌐 Scrapear TODOS los Proveedores Activos (Ecosistema Completo)", font=("Segoe UI", 9, "bold"), bg="#1e293b", fg="#38bdf8", bd=1, relief="solid", cursor="hand2", pady=5, command=self.start_scraping_all_provs)
        self.btn_scrape_all_provs.pack(fill=tk.X)

    # ─────────────────────────────────────────────────────────────────────────
    # PESTAÑA 2: EXTRACTOR RÁPIDO
    # ─────────────────────────────────────────────────────────────────────────
    def build_tab_rapido(self):
        card = tk.Frame(self.tab_rapido, bg="#161c2e", bd=1, relief="solid", padx=16, pady=14)
        card.pack(fill=tk.BOTH, expand=True)

        tk.Label(card, text="URL rápida a scrapear:", font=("Segoe UI", 10, "bold"), bg="#161c2e", fg="#e2e8f0").pack(anchor="w", pady=(0, 4))
        self.quick_url_var = tk.StringVar(value="")
        tk.Entry(card, textvariable=self.quick_url_var, bg="#0f1320", fg="#f8fafc", insertbackground="#fff", bd=1, relief="solid", font=("Segoe UI", 10)).pack(fill=tk.X, pady=(0, 10), ipady=4)

        opts_frame = tk.Frame(card, bg="#161c2e")
        opts_frame.pack(fill=tk.X, pady=(0, 12))

        # Scrolls
        s_col = tk.Frame(opts_frame, bg="#161c2e")
        s_col.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        tk.Label(s_col, text="Scrolls por página:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7").pack(anchor="w")
        self.quick_scrolls_var = tk.StringVar(value="15")
        tk.Spinbox(s_col, from_=1, to=100, textvariable=self.quick_scrolls_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10), width=6).pack(fill=tk.X, pady=(3, 0), ipady=2)

        # Margen
        m_col = tk.Frame(opts_frame, bg="#161c2e")
        m_col.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=6)
        tk.Label(m_col, text="Margen venta %:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7").pack(anchor="w")
        self.quick_margin_var = tk.StringVar(value="50")
        tk.Entry(m_col, textvariable=self.quick_margin_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10), width=8).pack(fill=tk.X, pady=(3, 0), ipady=2)

        # Proveedor
        p_col = tk.Frame(opts_frame, bg="#161c2e")
        p_col.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(6, 0))
        tk.Label(p_col, text="Nombre Proveedor:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#8896a7").pack(anchor="w")
        self.quick_prov_var = tk.StringVar(value="Distribuidor Web")
        tk.Entry(p_col, textvariable=self.quick_prov_var, bg="#0f1320", fg="#f8fafc", bd=1, relief="solid", font=("Segoe UI", 10)).pack(fill=tk.X, pady=(3, 0), ipady=2)

        tk.Button(card, text="🚀 INICIAR EXTRACCIÓN RÁPIDA", font=("Segoe UI", 10, "bold"), bg="#f97316", fg="#fff", bd=0, cursor="hand2", pady=8, command=self.start_scraping_quick).pack(fill=tk.X)

    # ─────────────────────────────────────────────────────────────────────────
    # MÉTODOS DE GESTIÓN DE CONFIGURACIÓN
    # ─────────────────────────────────────────────────────────────────────────
    def load_proveedores_list(self):
        self.config_data = cargar_proveedores_config()
        self.prov_listbox.delete(0, tk.END)
        proveedores = self.config_data.get("proveedores", [])
        
        for idx, p in enumerate(proveedores):
            nombre = p.get("nombre", "Sin nombre")
            cats = p.get("categorias", [])
            activas = sum(1 for c in cats if c.get("activo", True))
            self.prov_listbox.insert(tk.END, f"🏢 {nombre} ({activas}/{len(cats)})")

        if proveedores and self.selected_prov_id is None:
            self.prov_listbox.select_set(0)
            self.on_select_proveedor(None)

    def on_select_proveedor(self, event):
        sel = self.prov_listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        proveedores = self.config_data.get("proveedores", [])
        if idx >= len(proveedores):
            return

        prov = proveedores[idx]
        self.selected_prov_id = prov.get("id")
        nombre = prov.get("nombre", "")
        url = prov.get("url", "")
        ultima = prov.get("ultima_extraccion") or "Nunca"
        margen = prov.get("margen", 50.0)

        self.lbl_selected_title.config(text=f"🏢 {nombre} (Margen: {margen}%)")
        self.lbl_selected_info.config(text=f"URL: {url}\nÚltima extracción: {ultima}")

        self.render_categorias(prov)

    def render_categorias(self, prov):
        for widget in self.cat_inner_frame.winfo_children():
            widget.destroy()
        self.cat_vars.clear()

        cats = prov.get("categorias", [])
        for c in cats:
            url = c.get("url")
            nombre = c.get("nombre", "Sin nombre")
            activo = c.get("activo", True)

            var = tk.BooleanVar(value=activo)
            self.cat_vars[url] = var

            row = tk.Frame(self.cat_inner_frame, bg="#0f1320", pady=2)
            row.pack(fill=tk.X, expand=True)

            cb = tk.Checkbutton(
                row,
                text=nombre,
                variable=var,
                bg="#0f1320",
                fg="#f8fafc",
                activebackground="#0f1320",
                activeforeground="#38bdf8",
                selectcolor="#161c2e",
                font=("Segoe UI", 9),
                command=self.on_toggle_cat
            )
            cb.pack(side=tk.LEFT, anchor="w")

            tk.Label(row, text=url.split('/')[-1] or url, font=("Segoe UI", 8), bg="#0f1320", fg="#475569").pack(side=tk.RIGHT, padx=6)

        self.update_check_count()

    def on_toggle_cat(self):
        # Actualizar json
        if not self.selected_prov_id:
            return
        proveedores = self.config_data.get("proveedores", [])
        prov = next((p for p in proveedores if p.get("id") == self.selected_prov_id), None)
        if not prov:
            return

        for c in prov.get("categorias", []):
            url = c.get("url")
            if url in self.cat_vars:
                c["activo"] = self.cat_vars[url].get()

        guardar_proveedores_config(self.config_data)
        self.update_check_count()

    def check_all_cats(self):
        for v in self.cat_vars.values():
            v.set(True)
        self.on_toggle_cat()

    def uncheck_all_cats(self):
        for v in self.cat_vars.values():
            v.set(False)
        self.on_toggle_cat()

    def update_check_count(self):
        total = len(self.cat_vars)
        activas = sum(1 for v in self.cat_vars.values() if v.get())
        self.lbl_check_count.config(text=f"{activas}/{total} secciones activas")

    def dialog_nuevo_proveedor(self):
        dialog = tk.Toplevel(self)
        dialog.title("Agregar Nuevo Proveedor")
        dialog.geometry("460x300")
        dialog.configure(bg="#161c2e")
        dialog.transient(self)
        dialog.grab_set()

        tk.Label(dialog, text="➕ Registrar Nuevo Proveedor", font=("Segoe UI", 12, "bold"), bg="#161c2e", fg="#f97316").pack(anchor="w", padx=20, pady=(15, 10))

        tk.Label(dialog, text="Nombre del Proveedor:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#e2e8f0").pack(anchor="w", padx=20)
        name_entry = tk.Entry(dialog, bg="#0f1320", fg="#fff", insertbackground="#fff", bd=1, relief="solid", font=("Segoe UI", 10))
        name_entry.pack(fill=tk.X, padx=20, pady=(3, 10), ipady=3)
        name_entry.focus()

        tk.Label(dialog, text="URL del sitio web:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#e2e8f0").pack(anchor="w", padx=20)
        url_entry = tk.Entry(dialog, bg="#0f1320", fg="#fff", insertbackground="#fff", bd=1, relief="solid", font=("Segoe UI", 10))
        url_entry.pack(fill=tk.X, padx=20, pady=(3, 10), ipady=3)

        tk.Label(dialog, text="Margen de ganancia % por defecto:", font=("Segoe UI", 9, "bold"), bg="#161c2e", fg="#e2e8f0").pack(anchor="w", padx=20)
        margin_entry = tk.Entry(dialog, bg="#0f1320", fg="#fff", insertbackground="#fff", bd=1, relief="solid", font=("Segoe UI", 10))
        margin_entry.insert(0, "50")
        margin_entry.pack(fill=tk.X, padx=20, pady=(3, 15), ipady=3)

        def do_save():
            nombre = name_entry.get().strip()
            url = url_entry.get().strip()
            if not nombre or not url:
                messagebox.showwarning("Atención", "Completá el nombre y la URL.", parent=dialog)
                return
            if not url.startswith("http://") and not url.startswith("https://"):
                url = "https://" + url

            try:
                margen = float(margin_entry.get().replace(',', '.'))
            except ValueError:
                margen = 50.0

            dialog.destroy()
            
            # Mostrar de inmediato en la lista lateral con estado de escaneo
            self.prov_listbox.insert(tk.END, f"⏳ {nombre} (Escaneando menú...)")
            self.log(f"\n▶ Registrando nuevo proveedor: '{nombre}'")
            self.log(f"   URL: {url}")
            self.log(f"   Escaneando mega-menús y secciones en segundo plano...")
            
            threading.Thread(target=self._run_register_prov, args=(nombre, url, margen), daemon=True).start()

        tk.Button(dialog, text="🔍 Escanear Menú y Guardar Proveedor", font=("Segoe UI", 10, "bold"), bg="#f97316", fg="#fff", bd=0, cursor="hand2", pady=8, command=do_save).pack(fill=tk.X, padx=20)

    def _run_register_prov(self, nombre, url, margen):
        try:
            prov_id = registrar_o_actualizar_proveedor(nombre, url, margen=margen, callback_log=self.log)
            self.selected_prov_id = prov_id
            
            # Actualizar GUI en el hilo principal de forma segura
            self.after(0, self._on_register_prov_success, nombre)
        except Exception as e:
            self.log(f"❌ Error al registrar proveedor: {e}")
            self.after(0, lambda: messagebox.showerror("Error", f"Error escaneando proveedor:\n{e}"))
            self.after(0, self.load_proveedores_list)

    def _on_register_prov_success(self, nombre):
        self.load_proveedores_list()
        # Seleccionar el recién agregado
        proveedores = self.config_data.get("proveedores", [])
        for idx, p in enumerate(proveedores):
            if p.get("id") == self.selected_prov_id:
                self.prov_listbox.selection_clear(0, tk.END)
                self.prov_listbox.selection_set(idx)
                self.on_select_proveedor(None)
                break
        messagebox.showinfo("Éxito", f"¡Proveedor '{nombre}' guardado con éxito!\n\nYa podés ver todas sus secciones en pantalla y marcar las que quieras scrapear.")

    def rescan_selected_proveedor(self):
        if not self.selected_prov_id:
            messagebox.showwarning("Atención", "Seleccioná un proveedor de la lista.")
            return

        proveedores = self.config_data.get("proveedores", [])
        prov = next((p for p in proveedores if p.get("id") == self.selected_prov_id), None)
        if not prov:
            return

        self.log(f"▶ Re-escaneando secciones de '{prov['nombre']}'...")
        threading.Thread(target=self._run_register_prov, args=(prov["nombre"], prov["url"], prov.get("margen", 50.0)), daemon=True).start()

    def delete_selected_proveedor(self):
        if not self.selected_prov_id:
            return
        proveedores = self.config_data.get("proveedores", [])
        prov = next((p for p in proveedores if p.get("id") == self.selected_prov_id), None)
        if not prov:
            return

        if messagebox.askyesno("Confirmar", f"¿Seguro que querés eliminar a '{prov['nombre']}' de la lista?"):
            self.config_data["proveedores"] = [p for p in proveedores if p.get("id") != self.selected_prov_id]
            guardar_proveedores_config(self.config_data)
            self.selected_prov_id = None
            self.load_proveedores_list()
            for widget in self.cat_inner_frame.winfo_children():
                widget.destroy()

    # ─────────────────────────────────────────────────────────────────────────
    # EJECUCIÓN DEL SCRAPING
    # ─────────────────────────────────────────────────────────────────────────
    def start_scraping_selected_prov(self):
        if not self.selected_prov_id:
            messagebox.showwarning("Atención", "Seleccioná primero un proveedor.")
            return

        proveedores = self.config_data.get("proveedores", [])
        prov = next((p for p in proveedores if p.get("id") == self.selected_prov_id), None)
        if not prov:
            return

        activas = [c for c in prov.get("categorias", []) if c.get("activo", True)]
        if not activas:
            messagebox.showwarning("Atención", "Marcá al menos una sección con check para scrapear.")
            return

        self.btn_scrape_selected.config(state=tk.DISABLED, text="⏳ EXTRAYENDO SECCIONES SELECCIONADAS...")
        self.btn_open_csv.config(state=tk.DISABLED)
        self.log_text.delete("1.0", tk.END)

        threading.Thread(target=self._run_scrape_prov, args=(prov,), daemon=True).start()

    def _run_scrape_prov(self, prov):
        try:
            prods = scrapear_secciones_proveedor(prov, scrolls_por_cat=10, callback_log=self.log)
            if not prods:
                self.log("⚠️ No se extrajeron productos.")
            else:
                base_dir = Path(__file__).resolve().parent
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                safe_name = re.sub(r'[^a-zA-Z0-9_]+', '_', prov.get("nombre", "proveedor")).lower()
                output_base = base_dir / f"{safe_name}_{timestamp}"

                csv_path, xlsx_path = exportar_archivos(prods, ruta_salida_base=str(output_base))
                self.last_csv = csv_path
                self.last_xlsx = xlsx_path

                self.btn_open_csv.config(state=tk.NORMAL)
                self.load_proveedores_list() # actualizar fecha
                messagebox.showinfo("Éxito", f"¡Extracción completada!\n\nSe extrajeron {len(prods)} productos de las secciones seleccionadas.\n\nYa podés importarlo en FerrePro.")

        except Exception as e:
            self.log(f"❌ Error durante el scraping: {e}")
            messagebox.showerror("Error", f"Error: {e}")
        finally:
            self.btn_scrape_selected.config(state=tk.NORMAL, text="🚀 Scrapear Secciones Seleccionadas de este Proveedor")

    def start_scraping_all_provs(self):
        proveedores = self.config_data.get("proveedores", [])
        if not proveedores:
            messagebox.showwarning("Atención", "No hay proveedores registrados.")
            return

        if not messagebox.askyesno("Confirmar", f"¿Querés iniciar el rastreo de TODAS las secciones activas de los {len(proveedores)} proveedores guardados?"):
            return

        self.btn_scrape_all_provs.config(state=tk.DISABLED, text="⏳ RASTREANDO TODOS LOS PROVEEDORES...")
        self.btn_open_csv.config(state=tk.DISABLED)
        self.log_text.delete("1.0", tk.END)

        threading.Thread(target=self._run_scrape_all_provs, args=(proveedores,), daemon=True).start()

    def _run_scrape_all_provs(self, proveedores):
        try:
            todos_ecosistema = []
            vistos = set()

            for prov in proveedores:
                if not prov.get("activo", True):
                    continue
                prods = scrapear_secciones_proveedor(prov, scrolls_por_cat=10, callback_log=self.log)
                for p in prods:
                    clave = p["nombre"].lower().strip()
                    if clave not in vistos:
                        vistos.add(clave)
                        todos_ecosistema.append(p)

            if not todos_ecosistema:
                self.log("⚠️ No se encontraron productos.")
            else:
                base_dir = Path(__file__).resolve().parent
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_base = base_dir / f"catalogo_ecosistema_{timestamp}"

                csv_path, xlsx_path = exportar_archivos(todos_ecosistema, ruta_salida_base=str(output_base))
                self.last_csv = csv_path
                self.last_xlsx = xlsx_path

                self.btn_open_csv.config(state=tk.NORMAL)
                self.load_proveedores_list()
                messagebox.showinfo("Éxito Ecosistema", f"¡Rastreo masivo finalizado!\n\nSe extrajeron {len(todos_ecosistema)} productos consolidados de todos los proveedores.\n\nYa podés importarlo en FerrePro.")

        except Exception as e:
            self.log(f"❌ Error en rastreo masivo: {e}")
            messagebox.showerror("Error", f"Error: {e}")
        finally:
            self.btn_scrape_all_provs.config(state=tk.NORMAL, text="🌐 Scrapear TODOS los Proveedores Activos (Ecosistema Completo)")

    def start_scraping_quick(self):
        url = self.quick_url_var.get().strip()
        if not url:
            messagebox.showwarning("Atención", "Ingresá una URL.")
            return
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url

        try: scrolls = int(self.quick_scrolls_var.get())
        except ValueError: scrolls = 15

        try: margin = float(self.quick_margin_var.get().replace(',', '.'))
        except ValueError: margin = 50.0

        prov = self.quick_prov_var.get().strip() or "Distribuidor Web"

        self.log(f"▶ Extracción rápida: {url} | Margen: {margin}% | Prov: {prov}")
        threading.Thread(target=self._run_quick, args=(url, scrolls, prov, margin), daemon=True).start()

    def _run_quick(self, url, scrolls, prov, margin):
        try:
            prods = scrapear_scroll_infinito(url, max_scrolls=scrolls, proveedor=prov, margen_ganancia=margin, callback_log=self.log)
            if prods:
                base_dir = Path(__file__).resolve().parent
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_base = base_dir / f"rapido_{timestamp}"
                csv_path, xlsx_path = exportar_archivos(prods, ruta_salida_base=str(output_base))
                self.last_csv = csv_path
                self.last_xlsx = xlsx_path
                self.btn_open_csv.config(state=tk.NORMAL)
                messagebox.showinfo("Éxito", f"¡Se extrajeron {len(prods)} productos!")
        except Exception as e:
            self.log(f"❌ Error: {e}")

    def log(self, msg):
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.update_idletasks()

    def open_csv(self):
        if self.last_csv and os.path.exists(self.last_csv):
            os.startfile(self.last_csv)

    def open_folder(self):
        base_dir = Path(__file__).resolve().parent
        os.startfile(base_dir)

if __name__ == "__main__":
    app = ScraperGUI()
    app.mainloop()