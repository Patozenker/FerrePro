#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  FERREPRO - SCRAPER UNIVERSAL DE PRODUCTOS (STANDALONE)
===============================================================================
Este script funciona de manera 100% independiente de FerrePro.
Extrae productos, precios, fotos, categorías y códigos desde cualquier tienda web
y genera un archivo CSV / Excel listo para importar en FerrePro.

Uso:
  1. Modo interactivo:
     python scraper.py

  2. Modo línea de comandos:
     python scraper.py --url "https://ejemplo.com/categoria" --pages 3 --margin 50
===============================================================================
"""

import sys
import os
import re
import json
import argparse
import urllib.parse
from datetime import datetime
from pathlib import Path

# Soporte completo UTF-8 en terminales de Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    import requests
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError:
    print("[!] Faltan dependencias. Instalalas ejecutando:")
    print("    pip install requests beautifulsoup4 pandas openpyxl")
    sys.exit(1)

# Headers que simulan un navegador real moderno
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

def limpiar_precio(raw):
    """Convierte texto de precio crudo ($ 12.345,67 o USD 150) a float limpio."""
    if raw is None:
        return 0.0
    s = str(raw).strip()
    if not s:
        return 0.0
    
    # Quitar símbolos de moneda y espacios
    s = re.sub(r'[^\d.,]', '', s)
    if not s:
        return 0.0

    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        partes = s.split(",")
        if len(partes) == 2 and len(partes[1]) <= 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "." in s:
        partes = s.split(".")
        if len(partes) == 2 and len(partes[1]) == 3:
            s = s.replace(".", "")

    try:
        val = float(s)
        return round(val, 2)
    except ValueError:
        return 0.0

def detectar_moneda(texto_crudo):
    """Detecta si el precio está en USD o ARS."""
    t = str(texto_crudo).upper()
    if "USD" in t or "U$S" in t or "US$" in t or "DÓLAR" in t or "DOLAR" in t:
        return "USD"
    return "ARS"

def extraer_json_ld(soup, url_base):
    """Intenta extraer productos usando Schema.org JSON-LD structured data."""
    productos = []
    scripts = soup.find_all('script', type='application/ld+json')
    for script in scripts:
        try:
            data = json.loads(script.string or '')
            items = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                if data.get('@type') in ['Product', 'IndividualProduct']:
                    items = [data]
                elif '@graph' in data:
                    items = [x for x in data['@graph'] if isinstance(x, dict) and x.get('@type') in ['Product', 'IndividualProduct']]
                elif data.get('@type') == 'ItemList' and 'itemListElement' in data:
                    for el in data['itemListElement']:
                        if isinstance(el, dict) and 'item' in el and isinstance(el['item'], dict):
                            items.append(el['item'])
                        elif isinstance(el, dict) and el.get('@type') == 'Product':
                            items.append(el)

            for item in items:
                nombre = item.get('name') or ''
                if not nombre:
                    continue
                
                sku = item.get('sku') or item.get('mpn') or item.get('productID') or ''
                desc = item.get('description') or ''
                cat = item.get('category') or ''
                
                # Imagen
                img = item.get('image')
                foto_url = ""
                if isinstance(img, str):
                    foto_url = img
                elif isinstance(img, list) and len(img) > 0:
                    foto_url = img[0] if isinstance(img[0], str) else img[0].get('url', '')
                elif isinstance(img, dict):
                    foto_url = img.get('url', '')

                # Ofertas / Precio
                offers = item.get('offers')
                precio = 0.0
                moneda = "ARS"
                if isinstance(offers, dict):
                    precio = limpiar_precio(offers.get('price') or offers.get('lowPrice'))
                    moneda = offers.get('priceCurrency') or "ARS"
                elif isinstance(offers, list) and len(offers) > 0:
                    precio = limpiar_precio(offers[0].get('price') or offers[0].get('lowPrice'))
                    moneda = offers[0].get('priceCurrency') or "ARS"

                enlace = item.get('url') or url_base

                productos.append({
                    "sku": str(sku).strip(),
                    "nombre": str(nombre).strip(),
                    "categoria": str(cat).strip(),
                    "costo": precio,
                    "foto": foto_url,
                    "descripcion": str(desc).strip(),
                    "moneda": moneda,
                    "enlace": enlace
                })
        except Exception:
            continue
    return productos

def extraer_html_cards(soup, url_base):
    """Extrae productos analizando la estructura HTML (Shopify, WooCommerce, Magento, Prestashop, ML, etc.)."""
    productos = []
    domain = "/".join(url_base.split("/")[:3])
    
    # 1. Rubro / Categoría de la página
    rubro = "General"
    cat_tag = soup.find(['h1', 'h2'], class_=lambda c: c and any(k in c.lower() for k in ['title', 'category', 'heading', 'page-title'])) or soup.find('h1')
    if cat_tag and cat_tag.text.strip():
        rubro = cat_tag.text.strip()
    else:
        breadcrumbs = soup.find_all(['li', 'span', 'a'], class_=lambda c: c and 'breadcrumb' in c.lower())
        rutas = [b.text.replace('>', '').strip() for b in breadcrumbs if b.text.strip() and b.text.strip().lower() not in ['inicio', 'home']]
        if rutas:
            rubro = rutas[-1]

    # 2. Contenedores de productos
    items = soup.find_all(['li', 'article', 'div'], class_=lambda c: c and any(k in c.lower() for k in [
        'product-item', 'product-card', 'product-miniature', 'product-container',
        'js-item-product', 'ui-search-layout__item', 'poly-card', 'vtex-product-summary'
    ]))

    if not items or len(items) < 2:
        items = soup.find_all('article') or soup.find_all('li', class_=lambda c: c and 'col' in c.lower()) or soup.find_all('div', class_=lambda c: c and 'product' in c.lower() and 'grid' not in c.lower())

    for idx, item in enumerate(items):
        try:
            # A) Título
            titulo = ""
            title_tag = item.find(['h2', 'h3', 'h4', 'strong', 'a'], class_=lambda c: c and any(k in c.lower() for k in ['name', 'title', 'product-name', 'poly-component__title']))
            if title_tag:
                titulo = title_tag.text.strip()
            
            if not titulo:
                link_tag = item.find('a', title=True) or item.find('a')
                if link_tag and link_tag.get('title'):
                    titulo = link_tag.get('title').strip()
                elif link_tag and len(link_tag.text.strip()) > 4:
                    titulo = link_tag.text.strip()

            if not titulo:
                img_tag = item.find('img', alt=True)
                if img_tag and len(img_tag.get('alt', '').strip()) > 4:
                    titulo = img_tag.get('alt').strip()

            if not titulo or len(titulo) < 3:
                continue

            # B) SKU / Código
            codigo = ""
            ref_tag = item.find(['span', 'div', 'p', 'small'], class_=lambda c: c and any(k in c.lower() for k in ['sku', 'code', 'ref', 'reference', 'articulo']))
            if ref_tag:
                codigo = re.sub(r'^(sku|cód|cod|ref|articulo)[:\.\s]*', '', ref_tag.text, flags=re.IGNORECASE).strip()
            
            if not codigo:
                codigo_match = re.search(r'\b(?:SKU|CÓD|COD|REF|ART)[:\.\s]*([A-Z0-9\-_]+)\b', item.text, re.IGNORECASE)
                if codigo_match:
                    codigo = codigo_match.group(1).strip()

            # C) Precio y Moneda
            precio_crudo = ""
            price_box = item.find(['div', 'span', 'p'], class_=lambda c: c and any(k in c.lower() for k in ['price', 'precio', 'poly-price', 'current-price', 'special-price', 'price_color']))
            if price_box:
                precio_crudo = price_box.text.strip()
            else:
                price_match = re.search(r'(?:USD|\$|U\$S|ARS|£|€)\s*[\d.,]+', item.text)
                if price_match:
                    precio_crudo = price_match.group(0)

            costo = limpiar_precio(precio_crudo)
            moneda = detectar_moneda(precio_crudo)

            # D) Imagen
            foto_url = ""
            img_tag = item.find('img')
            if img_tag:
                foto_url = (img_tag.get('data-src') or 
                            img_tag.get('data-lazy-src') or 
                            img_tag.get('data-original') or 
                            img_tag.get('src') or "")
                if img_tag.get('srcset') and not foto_url:
                    foto_url = img_tag.get('srcset').split(',')[0].split(' ')[0]

            if foto_url.startswith('//'):
                foto_url = 'https:' + foto_url
            elif foto_url.startswith('/'):
                foto_url = domain + foto_url
            elif foto_url and not foto_url.startswith('http'):
                foto_url = urllib.parse.urljoin(url_base, foto_url)

            # E) Enlace
            enlace = ""
            a_tag = item.find('a', href=True)
            if a_tag:
                enlace = a_tag['href']
                if enlace.startswith('/'):
                    enlace = domain + enlace
                elif not enlace.startswith('http'):
                    enlace = urllib.parse.urljoin(url_base, enlace)

            productos.append({
                "sku": codigo,
                "nombre": titulo,
                "categoria": rubro,
                "costo": costo,
                "foto": foto_url,
                "descripcion": "",
                "moneda": moneda,
                "enlace": enlace
            })
        except Exception:
            continue

    return productos

def scrapear_url(url_inicial, max_paginas=5, proveedor="Distribuidor Web", margen_ganancia=50.0):
    """Recorre la URL inicial y paginaciones para extraer todos los productos."""
    todos_productos = []
    vistos = set()
    url_actual = url_inicial
    pagina = 1
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    print(f"\n[+] Iniciando extraccion desde: {url_inicial}")
    print(f"[*] Configuracion: Max paginas: {max_paginas} | Margen: {margen_ganancia}% | Proveedor: '{proveedor}'\n")

    while url_actual and pagina <= max_paginas:
        print(f"[*] [{pagina}/{max_paginas}] Consultando: {url_actual}")
        try:
            resp = session.get(url_actual, timeout=18)
            if resp.status_code != 200:
                print(f"[!] El servidor respondio con codigo HTTP {resp.status_code}")
                break
        except Exception as err:
            print(f"[-] Error de conexion: {err}")
            break

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Probar primero JSON-LD y luego HTML
        prods_json = extraer_json_ld(soup, url_actual)
        prods_html = extraer_html_cards(soup, url_actual)

        # Combinar priorizando los que tengan precio > 0 y foto
        candidatos = prods_json if len(prods_json) >= len(prods_html) and len(prods_json) > 0 else prods_html
        if not candidatos:
            candidatos = prods_json + prods_html

        agregados_pag = 0
        for p in candidatos:
            clave = (p['nombre'].lower().strip(), p['costo'])
            if clave not in vistos and len(p['nombre']) > 2:
                vistos.add(clave)
                todos_productos.append(p)
                agregados_pag += 1

        print(f"   -> {agregados_pag} productos encontrados en esta pagina.")

        if agregados_pag == 0 and pagina > 1:
            break

        # 3. Detectar botón o enlace de página siguiente
        next_btn = (soup.find('a', rel='next') or
                    soup.find('a', class_=lambda c: c and any(k in c.lower() for k in ['next', 'siguiente', 'pagination__next'])) or
                    soup.find('a', title=lambda t: t and 'siguiente' in t.lower()))

        if next_btn and next_btn.get('href'):
            next_url = next_btn['href']
            domain = "/".join(url_inicial.split("/")[:3])
            if next_url.startswith('/'):
                url_actual = domain + next_url
            elif next_url.startswith('http'):
                url_actual = next_url
            else:
                url_actual = urllib.parse.urljoin(url_actual, next_url)
            pagina += 1
        else:
            # Probar parámetro común ?page=N o ?p=N si no hay botón
            if "page=" in url_actual:
                url_actual = re.sub(r'page=\d+', f'page={pagina+1}', url_actual)
            elif "p=" in url_actual:
                url_actual = re.sub(r'p=\d+', f'p={pagina+1}', url_actual)
            else:
                url_actual = None
            pagina += 1

    # Formatear productos al estándar final de FerrePro
    formateados = []
    for i, p in enumerate(todos_productos, start=1):
        costo = p['costo']
        # Calcular precio de venta con el margen
        venta = round(costo * (1 + margen_ganancia / 100)) if costo > 0 else 0
        sku = p['sku'] if p['sku'] else f"IMP-{str(i).zfill(4)}"

        formateados.append({
            "sku": sku,
            "nombre": p['nombre'],
            "categoria": p['categoria'] if p['categoria'] else "Herramientas",
            "costo": costo,
            "venta": venta,
            "stock": 10,
            "minStock": 3,
            "foto": p['foto'],
            "descripcion": p['descripcion'],
            "moneda": p['moneda'],
            "proveedor": proveedor,
            "enlace": p['enlace'],
            "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

    return formateados

def exportar_archivos(productos, ruta_salida_base="productos_ferrepro"):
    """Guarda los productos en formato CSV (con BOM UTF-8) y Excel XLSX."""
    if not productos:
        print("[!] No hay productos para exportar.")
        return None, None

    df = pd.DataFrame(productos)

    # Columnas ordenadas listas para FerrePro
    columnas = [
        "sku", "nombre", "categoria", "costo", "venta",
        "stock", "minStock", "foto", "descripcion",
        "moneda", "proveedor", "enlace"
    ]
    df_clean = df[[c for c in columnas if c in df.columns]]

    csv_path = f"{ruta_salida_base}.csv"
    xlsx_path = f"{ruta_salida_base}.xlsx"

    # Exportar CSV con UTF-8 con BOM para que Excel y FerrePro lean tildes y caracteres especiales perfectamente
    df_clean.to_csv(csv_path, index=False, encoding='utf-8-sig')
    try:
        df_clean.to_excel(xlsx_path, index=False)
    except Exception:
        xlsx_path = None

    print("\n" + "="*60)
    print(f"[OK] EXTRACCION COMPLETADA CON EXITO: {len(productos)} productos")
    print("="*60)
    print(f"[*] CSV generado:   {Path(csv_path).resolve()}")
    if xlsx_path:
        print(f"[*] Excel generado: {Path(xlsx_path).resolve()}")
    print("="*60)
    print("[*] Podes arrastrar este archivo CSV directamente a FerrePro en:")
    print("    Inventario > Boton 'Importar' > Subir archivo")
    print("="*60 + "\n")

    return csv_path, xlsx_path

def main():
    parser = argparse.ArgumentParser(description="FerrePro Scraper Universal de Productos (Standalone)")
    parser.add_argument("--url", help="URL del catálogo o categoría a scrapear")
    parser.add_argument("--pages", type=int, default=3, help="Cantidad máxima de páginas a recorrer (default: 3)")
    parser.add_argument("--margin", type=float, default=50.0, help="Margen de ganancia %% para calcular precio de venta (default: 50)")
    parser.add_argument("--prov", default="Distribuidor Web", help="Nombre del proveedor asignado")
    parser.add_argument("--output", default="productos_ferrepro", help="Nombre base del archivo de salida (sin extensión)")

    args = parser.parse_args()

    url = args.url
    if not url:
        print("\n" + "#"*60)
        print("   FERREPRO - SCRAPER UNIVERSAL DE PRODUCTOS")
        print("#"*60 + "\n")
        url = input("Ingresa la URL del catalogo o proveedor: ").strip()
        if not url:
            print("[-] No se ingreso ninguna URL. Saliendo.")
            return

        pages_input = input("Cuantas paginas queres recorrer? (Enter para 3): ").strip()
        pages = int(pages_input) if pages_input.isdigit() else 3

        margin_input = input("Margen de ganancia % sugerido (Enter para 50%): ").strip()
        margin = float(margin_input) if margin_input.replace('.', '').isdigit() else 50.0

        prov_input = input("Nombre del proveedor (Enter para 'Distribuidor Web'): ").strip()
        prov = prov_input if prov_input else "Distribuidor Web"
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        output = f"productos_{timestamp}"
    else:
        pages = args.pages
        margin = args.margin
        prov = args.prov
        output = args.output

    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    prods = scrapear_url(url, max_paginas=pages, proveedor=prov, margen_ganancia=margin)
    exportar_archivos(prods, ruta_salida_base=output)

if __name__ == "__main__":
    main()