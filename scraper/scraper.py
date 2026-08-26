#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  FERREPRO - SCRAPER UNIVERSAL DE PRODUCTOS (STANDALONE + SCROLL INFINITO)
===============================================================================
Extrae catálogos completos para FerrePro con soporte de:
- Extracción ultra-precisa de precios (ArgSeguridad, MercadoLibre, WooCommerce, Shopify, Magento, Tiendanube, VTEX, Prestashop, etc.)
- Extracción de imágenes en alta resolución (lazy-load, srcset, zoom, data-src)
- Stock en 0 (modo lista de precios de catálogo)
- Precio de venta = Costo x (1 + Margen %)
- Modo Estándar (Paginación) y Modo Scroll Infinito (JavaScript / Playwright)
===============================================================================
"""

import sys
import os
import re
import json
import time
import argparse
import urllib.parse
from datetime import datetime
from pathlib import Path

# Soporte UTF-8 en Windows
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
    print("[!] Faltan dependencias. Instalalas con:")
    print("    pip install requests beautifulsoup4 pandas openpyxl playwright")
    sys.exit(1)

PLAYWRIGHT_AVAILABLE = False
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
}

def limpiar_num(s):
    if not s:
        return 0.0
    s = re.sub(r"[^\d.,]", "", str(s).strip())
    if not s:
        return 0.0
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        p = s.split(",")
        if len(p) == 2 and len(p[1]) <= 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "." in s:
        p = s.split(".")
        if len(p) == 2 and len(p[1]) == 3:
            s = s.replace(".", "")
    try:
        return round(float(s), 2)
    except:
        return 0.0

def detectar_moneda(texto_crudo):
    t = str(texto_crudo).upper()
    if "USD" in t or "U$S" in t or "US$" in t or "DÓLAR" in t or "DOLAR" in t:
        return "USD"
    return "ARS"

def extraer_precio_completo(item_soup):
    """
    Motor multi-capa para extraer el precio real de un producto en cualquier plataforma,
    evitando la concatenación errónea de monedas dobles (ej: ARS y USD).
    """
    soup = BeautifulSoup(str(item_soup), "html.parser")

    # 1. Atributos semánticos directos con content numérico (ej: content="51836.4")
    for attr in ["itemprop", "data-price", "data-product-price", "data-price-amount"]:
        tag = soup.find(attrs={attr: True})
        if tag:
            v = tag.get("content") or tag.get(attr)
            if v:
                p = limpiar_num(v)
                if p > 0:
                    return p, "ARS"

    # 2. Descartar precios anteriores / tachados
    for old_tag in soup.find_all(["del", "s"], class_=lambda c: c and any(k in str(c).lower() for k in ["old", "before", "was", "previous", "tachado", "strike"])):
        old_tag.decompose()
    for prev in soup.find_all(class_=lambda c: c and any(k in str(c).lower() for k in ["andes-money-amount--previous", "old-price", "was-price", "precio-anterior"])):
        prev.decompose()

    # 3. MercadoLibre (fracción + centavos)
    ml_frac = soup.find(class_=lambda c: c and "andes-money-amount__fraction" in str(c))
    if ml_frac:
        ml_cents = soup.find(class_=lambda c: c and "andes-money-amount__cents" in str(c))
        cents_str = f".{ml_cents.text.strip()}" if ml_cents else ""
        raw_ml = f"{ml_frac.text.strip()}{cents_str}"
        p = limpiar_num(raw_ml)
        if p > 0:
            return p, "ARS"

    # 4. Descomponer strings individuales para evitar concatenar precios múltiples
    textos = list(soup.stripped_strings)
    texto_limpio = " ".join(textos)

    # 5. Buscar ARS primero (ej: "ARS 51.836,40" o "$ 15.400")
    m_ars = re.search(r"(?:ARS|\$)\s*([\d\.,]+)", texto_limpio, re.IGNORECASE)
    if m_ars:
        p = limpiar_num(m_ars.group(1))
        if p > 0:
            return p, "ARS"

    # 6. Buscar USD
    m_usd = re.search(r"(?:USD|U\$S|US\$)\s*([\d\.,]+)", texto_limpio, re.IGNORECASE)
    if m_usd:
        p = limpiar_num(m_usd.group(1))
        if p > 0:
            return p, "USD"

    # 7. Fallback a primer número en tag con clase de precio
    price_tag = soup.find(class_=lambda c: c and any(k in str(c).lower() for k in [
        "special-price", "current-price", "price-item", "product-price", "item-price", "price", "precio"
    ]))
    if price_tag:
        for string_part in price_tag.stripped_strings:
            p = limpiar_num(string_part)
            if p > 0:
                return p, "ARS"

    return 0.0, "ARS"

def extraer_foto_completa(item_soup, domain, url_base):
    """Extrae la URL de imagen en alta resolución probando lazy-loading y srcset."""
    img_tag = item_soup.find('img')
    foto_url = ""
    if img_tag:
        foto_url = (
            img_tag.get('data-zoom-image') or
            img_tag.get('data-src') or
            img_tag.get('data-lazy-src') or
            img_tag.get('data-original') or
            img_tag.get('data-hi-res-src') or
            img_tag.get('src') or ""
        )
        if (not foto_url or 'placeholder' in foto_url.lower() or 'data:image' in foto_url) and img_tag.get('srcset'):
            partes = [p.strip().split(' ')[0] for p in img_tag.get('srcset').split(',') if p.strip()]
            if partes:
                foto_url = partes[-1]

    if not foto_url:
        bg_match = re.search(r'background(?:-image)?:\s*url\([\'"]?([^\'")]+)[\'"]?\)', str(item_soup))
        if bg_match:
            foto_url = bg_match.group(1)

    if not foto_url:
        return ""

    if foto_url.startswith('//'):
        return 'https:' + foto_url
    elif foto_url.startswith('/'):
        return domain + foto_url
    elif not foto_url.startswith('http'):
        return urllib.parse.urljoin(url_base, foto_url)
    return foto_url

def extraer_json_ld(soup, url_base):
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

                img = item.get('image')
                foto_url = ""
                if isinstance(img, str):
                    foto_url = img
                elif isinstance(img, list) and len(img) > 0:
                    foto_url = img[0] if isinstance(img[0], str) else img[0].get('url', '')
                elif isinstance(img, dict):
                    foto_url = img.get('url', '')

                offers = item.get('offers')
                precio = 0.0
                moneda = "ARS"
                if isinstance(offers, dict):
                    precio = limpiar_num(offers.get('price') or offers.get('lowPrice'))
                    moneda = offers.get('priceCurrency') or "ARS"
                elif isinstance(offers, list) and len(offers) > 0:
                    precio = limpiar_num(offers[0].get('price') or offers[0].get('lowPrice'))
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
    productos = []
    domain = "/".join(url_base.split("/")[:3])

    rubro = "General"
    cat_tag = soup.find(['h1', 'h2'], class_=lambda c: c and any(k in str(c).lower() for k in ['title', 'category', 'heading', 'page-title'])) or soup.find('h1')
    if cat_tag and cat_tag.text.strip():
        rubro = cat_tag.text.strip()
    else:
        breadcrumbs = soup.find_all(['li', 'span', 'a'], class_=lambda c: c and 'breadcrumb' in str(c).lower())
        rutas = [b.text.replace('>', '').strip() for b in breadcrumbs if b.text.strip() and b.text.strip().lower() not in ['inicio', 'home']]
        if rutas:
            rubro = rutas[-1]

    items = soup.find_all(['li', 'article', 'div'], class_=lambda c: c and any(k in str(c).lower() for k in [
        'product-item', 'product-card', 'product-miniature', 'product-container',
        'js-item-product', 'ui-search-layout__item', 'poly-card', 'vtex-product-summary', 'item-product'
    ]))

    if not items or len(items) < 2:
        items = soup.find_all('article') or soup.find_all('li', class_=lambda c: c and 'col' in str(c).lower()) or soup.find_all('div', class_=lambda c: c and 'product' in str(c).lower() and 'grid' not in str(c).lower())

    for idx, item in enumerate(items):
        try:
            titulo = ""
            title_tag = item.find(['h2', 'h3', 'h4', 'strong', 'a'], class_=lambda c: c and any(k in str(c).lower() for k in ['name', 'title', 'product-name', 'poly-component__title', 'item-name']))
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

            codigo = ""
            ref_tag = item.find(['span', 'div', 'p', 'small'], class_=lambda c: c and any(k in str(c).lower() for k in ['sku', 'code', 'ref', 'reference', 'articulo']))
            if ref_tag:
                codigo = re.sub(r'^(sku|cód|cod|ref|articulo)[:\.\s]*', '', ref_tag.text, flags=re.IGNORECASE).strip()

            if not codigo:
                codigo_match = re.search(r'\b(?:SKU|CÓD|COD|REF|ART)[:\.\s]*([A-Z0-9\-_]+)\b', item.text, re.IGNORECASE)
                if codigo_match:
                    codigo = codigo_match.group(1).strip()

            costo, moneda = extraer_precio_completo(item)
            foto_url = extraer_foto_completa(item, domain, url_base)

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

# =============================================================================
# MODO DINÁMICO: SCROLL INFINITO CON PLAYWRIGHT
# =============================================================================
def scrapear_scroll_infinito(url, max_scrolls=20, scroll_delay=1.5, proveedor="Distribuidor Web", margen_ganancia=50.0, callback_log=None):
    def log(msg):
        if callback_log:
            callback_log(msg)
        else:
            print(msg)

    if not PLAYWRIGHT_AVAILABLE:
        log("[-] Playwright no está disponible. Usando modo estático...")
        return scrapear_url(url, max_paginas=5, proveedor=proveedor, margen_ganancia=margen_ganancia)

    log(f"\n[+] Iniciando extracción con SCROLL INFINITO: {url}")
    log(f"[*] Configuración: Máx. scrolls: {max_scrolls} | Margen: {margen_ganancia}% | Proveedor: {proveedor}")

    todos_productos = []
    vistos = set()

    with sync_playwright() as p:
        try:
            try:
                browser = p.chromium.launch(headless=True)
            except Exception:
                browser = p.chromium.launch(channel="msedge", headless=True)
        except Exception as e:
            log(f"[-] Error iniciando navegador: {e}. Usando modo estático...")
            return scrapear_url(url, max_paginas=5, proveedor=proveedor, margen_ganancia=margen_ganancia)

        context = browser.new_context(
            viewport={"width": 1366, "height": 900},
            user_agent=DEFAULT_HEADERS["User-Agent"]
        )
        page = context.new_page()

        try:
            log("[*] Conectando y cargando página...")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)
        except Exception as err:
            log(f"[-] Error al conectar: {err}")
            browser.close()
            return []

        last_height = page.evaluate("document.body.scrollHeight")
        scroll_count = 0
        sin_cambios = 0

        while scroll_count < max_scrolls:
            scroll_count += 1
            log(f"[*] Scroll [{scroll_count}/{max_scrolls}] - Desplazando hacia abajo...")

            page.evaluate("""
                window.scrollBy({
                    top: window.innerHeight * 1.8,
                    left: 0,
                    behavior: 'smooth'
                });
            """)
            page.wait_for_timeout(int(scroll_delay * 1000))

            html_actual = page.content()
            soup = BeautifulSoup(html_actual, 'html.parser')

            prods_json = extraer_json_ld(soup, url)
            prods_html = extraer_html_cards(soup, url)
            candidatos = prods_json if len(prods_json) >= len(prods_html) and len(prods_json) > 0 else prods_html
            if not candidatos:
                candidatos = prods_json + prods_html

            nuevos_en_este_scroll = 0
            for prod in candidatos:
                clave = prod['nombre'].lower().strip()
                if clave not in vistos and len(prod['nombre']) > 2:
                    vistos.add(clave)
                    todos_productos.append(prod)
                    nuevos_en_este_scroll += 1

            con_precio = sum(1 for x in todos_productos if x['costo'] > 0)
            log(f"   -> Total acumulado: {len(todos_productos)} productos ({con_precio} con precio detectado)")

            new_height = page.evaluate("document.body.scrollHeight")
            if new_height == last_height and nuevos_en_este_scroll == 0:
                sin_cambios += 1
                if sin_cambios >= 3:
                    log("[*] Fin de catálogo alcanzado.")
                    break
            else:
                sin_cambios = 0
            last_height = new_height

        browser.close()

    formateados = []
    for i, p in enumerate(todos_productos, start=1):
        costo = p['costo']
        venta = round(costo * (1 + margen_ganancia / 100)) if costo > 0 else 0
        sku = p['sku'] if p['sku'] else f"IMP-{str(i).zfill(4)}"

        formateados.append({
            "sku": sku,
            "nombre": p['nombre'],
            "categoria": p['categoria'] if p['categoria'] else "Herramientas",
            "costo": costo,
            "venta": venta,
            "stock": 0,       # Stock en 0 por defecto para listas de precios
            "minStock": 3,
            "foto": p['foto'],
            "descripcion": p['descripcion'],
            "moneda": p['moneda'],
            "proveedor": proveedor,
            "enlace": p['enlace'],
            "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M")
        })

    return formateados

# =============================================================================
# MODO ESTÁNDAR (PAGINACIÓN RÁPIDA HTTP)
# =============================================================================
def scrapear_url(url_inicial, max_paginas=5, proveedor="Distribuidor Web", margen_ganancia=50.0, callback_log=None):
    def log(msg):
        if callback_log:
            callback_log(msg)
        else:
            print(msg)

    todos_productos = []
    vistos = set()
    url_actual = url_inicial
    pagina = 1
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    log(f"\n[+] Iniciando extracción estática: {url_inicial}")
    log(f"[*] Configuración: Máx. páginas: {max_paginas} | Margen: {margen_ganancia}% | Proveedor: '{proveedor}'\n")

    while url_actual and pagina <= max_paginas:
        log(f"[*] [{pagina}/{max_paginas}] Consultando: {url_actual}")
        try:
            resp = session.get(url_actual, timeout=18)
            if resp.status_code != 200:
                log(f"[!] El servidor respondió con código HTTP {resp.status_code}")
                break
        except Exception as err:
            log(f"[-] Error de conexión: {err}")
            break

        soup = BeautifulSoup(resp.text, 'html.parser')

        prods_json = extraer_json_ld(soup, url_actual)
        prods_html = extraer_html_cards(soup, url_actual)

        candidatos = prods_json if len(prods_json) >= len(prods_html) and len(prods_json) > 0 else prods_html
        if not candidatos:
            candidatos = prods_json + prods_html

        agregados_pag = 0
        for p in candidatos:
            clave = p['nombre'].lower().strip()
            if clave not in vistos and len(p['nombre']) > 2:
                vistos.add(clave)
                todos_productos.append(p)
                agregados_pag += 1

        log(f"   -> {agregados_pag} productos encontrados en esta página.")

        if agregados_pag == 0 and pagina > 1:
            break

        next_btn = (soup.find('a', rel='next') or
                    soup.find('a', class_=lambda c: c and any(k in str(c).lower() for k in ['next', 'siguiente', 'pagination__next'])) or
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
            if "page=" in url_actual:
                url_actual = re.sub(r'page=\d+', f'page={pagina+1}', url_actual)
            elif "p=" in url_actual:
                url_actual = re.sub(r'p=\d+', f'p={pagina+1}', url_actual)
            else:
                url_actual = None
            pagina += 1

    formateados = []
    for i, p in enumerate(todos_productos, start=1):
        costo = p['costo']
        venta = round(costo * (1 + margen_ganancia / 100)) if costo > 0 else 0
        sku = p['sku'] if p['sku'] else f"IMP-{str(i).zfill(4)}"

        formateados.append({
            "sku": sku,
            "nombre": p['nombre'],
            "categoria": p['categoria'] if p['categoria'] else "Herramientas",
            "costo": costo,
            "venta": venta,
            "stock": 0,       # Stock en 0 por defecto para listas de precios
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
    if not productos:
        print("[!] No hay productos para exportar.")
        return None, None

    df = pd.DataFrame(productos)
    columnas = [
        "sku", "nombre", "categoria", "costo", "venta",
        "stock", "minStock", "foto", "descripcion",
        "moneda", "proveedor", "enlace"
    ]
    df_clean = df[[c for c in columnas if c in df.columns]]

    out_file = Path(ruta_salida_base).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    csv_path = str(out_file) + (".csv" if not str(out_file).endswith(".csv") else "")
    xlsx_path = str(out_file) + (".xlsx" if not str(out_file).endswith(".xlsx") else "")

    df_clean.to_csv(csv_path, index=False, encoding='utf-8-sig')
    try:
        df_clean.to_excel(xlsx_path, index=False)
    except Exception:
        xlsx_path = None

    print("\n" + "="*60)
    print(f"[OK] EXTRACCIÓN COMPLETADA: {len(productos)} productos guardados")
    print("="*60)
    print(f"[*] CSV generado:   {Path(csv_path).resolve()}")
    if xlsx_path:
        print(f"[*] Excel generado: {Path(xlsx_path).resolve()}")
    print("="*60)
    print("[*] Podés arrastrar este archivo CSV a FerrePro en:")
    print("    Inventario > Botón 'Importar' > Subir archivo")
    print("="*60 + "\n")

    return csv_path, xlsx_path

def main():
    parser = argparse.ArgumentParser(description="FerrePro Scraper Universal (Standalone + Scroll Infinito)")
    parser.add_argument("--url", help="URL del catálogo o categoría a scrapear")
    parser.add_argument("--scroll", action="store_true", help="Activar modo Scroll Infinito (Playwright / Headless)")
    parser.add_argument("--scrolls", type=int, default=20, help="Cantidad de scrolls hacia abajo en modo dinámico (default: 20)")
    parser.add_argument("--pages", type=int, default=5, help="Cantidad máxima de páginas en modo estático (default: 5)")
    parser.add_argument("--margin", type=float, default=50.0, help="Margen de ganancia %% para calcular precio de venta (default: 50)")
    parser.add_argument("--prov", default="Distribuidor Web", help="Nombre del proveedor asignado")
    parser.add_argument("--output", default="productos_ferrepro", help="Nombre base del archivo de salida (sin extensión)")

    args = parser.parse_args()

    url = args.url
    scroll_mode = args.scroll

    if not url:
        print("\n" + "#"*60)
        print("   FERREPRO - SCRAPER UNIVERSAL DE PRODUCTOS")
        print("#"*60 + "\n")
        url = input("Ingresá la URL del catálogo o proveedor: ").strip()
        if not url:
            print("[-] No se ingresó ninguna URL. Saliendo.")
            return

        scroll_choice = input("¿La página tiene Scroll Infinito o carga dinámica? (s/N): ").strip().lower()
        scroll_mode = scroll_choice in ['s', 'si', 'y', 'yes', 'true', '1']

        if scroll_mode:
            scrolls_input = input("¿Cuántos scrolls hacia abajo hacer? (Enter para 20): ").strip()
            scrolls_count = int(scrolls_input) if scrolls_input.isdigit() else 20
        else:
            pages_input = input("¿Cuántas páginas querés recorrer? (Enter para 5): ").strip()
            pages_count = int(pages_input) if pages_input.isdigit() else 5

        margin_input = input("Margen de ganancia % sugerido (Enter para 50%): ").strip()
        margin = float(margin_input) if margin_input.replace('.', '').isdigit() else 50.0

        prov_input = input("Nombre del proveedor (Enter para 'Distribuidor Web'): ").strip()
        prov = prov_input if prov_input else "Distribuidor Web"

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = f"productos_{timestamp}"
    else:
        scrolls_count = args.scrolls
        pages_count = args.pages
        margin = args.margin
        prov = args.prov
        output = args.output

    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    if scroll_mode:
        prods = scrapear_scroll_infinito(url, max_scrolls=scrolls_count, proveedor=prov, margen_ganancia=margin)
    else:
        prods = scrapear_url(url, max_paginas=pages_count, proveedor=prov, margen_ganancia=margin)
        if len(prods) == 0 and PLAYWRIGHT_AVAILABLE:
            print("\n[!] No se detectaron productos con paginación tradicional.")
            print("[*] Reintentando automáticamente con modo Scroll Infinito (JavaScript)...")
            prods = scrapear_scroll_infinito(url, max_scrolls=15, proveedor=prov, margen_ganancia=margin)

    exportar_archivos(prods, ruta_salida_base=output)

if __name__ == "__main__":
    main()