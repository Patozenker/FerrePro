from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
from datetime import datetime
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    url: str

_ultimo_excel = {"path": None}


def _parse_precio(raw):
    if not raw:
        return 0.0
    s = str(raw).strip()
    if not s:
        return 0.0
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        partes = s.split(",")
        s = s.replace(",", ".") if len(partes) == 2 and len(partes[1]) <= 2 else s.replace(",", "")
    elif "." in s:
        partes = s.split(".")
        if len(partes) == 2 and len(partes[1]) == 3:
            s = s.replace(".", "")
    try:
        return float(re.sub(r"[^\d.]", "", s))
    except ValueError:
        return 0.0

def ejecutar_scraping(url_base):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    productos_lista = []
    url_actual = url_base
    pagina = 1
    rubro = "General"
    es_argseguridad = 'argseguridad.com' in url_base.lower()

    while url_actual:
        print(f"📄 Procesando página {pagina}: {url_actual}")
        try:
            response = requests.get(url_actual, headers=headers, timeout=15)
            if response.status_code != 200: break
        except Exception:
            break

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. RUBRO
        if pagina == 1:
            page_title = soup.find('h1', class_='page-title') or soup.find('h1')
            if page_title and page_title.text.strip():
                rubro = page_title.text.strip()
            else:
                breadcrumbs = soup.find_all(['li', 'span'], class_=lambda c: c and 'breadcrumb' in c.lower())
                textos_rutas = [b.text.replace('>', '').strip() for b in breadcrumbs if b.text.strip() and b.text.strip().lower() != 'inicio']
                if textos_rutas: rubro = textos_rutas[-1]

        # 2. PRODUCTOS
        items = soup.find_all('li', class_=lambda c: c and 'product-item' in c) or \
                soup.find_all('article', class_='product-miniature') or \
                soup.find_all('div', class_='product-item-info') or \
                soup.find_all('div', class_='product-container')
        
        if not items: break 

        for item in items:
            try:
                # Título
                titulo = "N/A"
                strong_tag = item.find(['strong', 'h2', 'h3'], class_=lambda c: c and 'name' in c.lower())
                if strong_tag: titulo = strong_tag.text.strip()
                if titulo == "N/A" or not titulo:
                    link_tag = item.find('a', class_=lambda c: c and 'product-item-link' in c)
                    if link_tag: titulo = link_tag.text.strip()
                img_tag = item.find('img')
                if titulo == "N/A" or not titulo:
                    if img_tag and img_tag.get('alt'): titulo = img_tag.get('alt').strip()

                # Código
                codigo = "N/A"
                ref_tags = item.find_all(['span', 'div', 'p'], class_=lambda c: c and ('reference' in c.lower() or 'sku' in c.lower() or 'code' in c.lower()))
                for r in ref_tags:
                    texto_ref = r.text.replace('Ref:', '').replace('SKU:', '').strip()
                    if texto_ref:
                        codigo = texto_ref
                        break

                # --- PRECIOS ESTRICTOS ---
                precio_crudo = ""
                price_container = item.find('div', class_='price-box') or item.find('div', class_='product-price-and-shipping')
                
                if price_container:
                    if es_argseguridad:
                        textos_usd = [p.text.strip() for p in price_container.find_all(['span', 'div']) if 'USD' in p.text]
                        if textos_usd: precio_crudo = textos_usd[0]
                    else:
                        # Buscar precio especial primero
                        precio_especial = price_container.find(attrs={"data-price-type": "finalPrice"}) or \
                                          price_container.find('span', class_='special-price')
                        
                        if precio_especial:
                            span = precio_especial.find('span', class_='price') or precio_especial
                            precio_crudo = span.text.strip()
                        else:
                            # Si no hay oferta, buscar el primero que no esté tachado
                            for p in price_container.find_all('span', class_='price'):
                                if p.find_parent(class_=lambda c: c and 'old-price' in c.lower()): continue
                                precio_crudo = p.text.strip()
                                break

                # MEDIDA DE SEGURIDAD: Si por alguna razón queda pegado con un guion, cortarlo.
                if "-" in precio_crudo:
                    precio_crudo = precio_crudo.split('-')[0].strip()

                moneda = "Consultar"
                valor_numerico = ""
                
                if precio_crudo:
                    if "USD" in precio_crudo or "U$S" in precio_crudo:
                        moneda = "USD"
                        valor_numerico = re.sub(r'[^\d\.,]', '', precio_crudo)
                    elif "$" in precio_crudo or "ARS" in precio_crudo:
                        moneda = "ARS"
                        valor_numerico = re.sub(r'[^\d\.,]', '', precio_crudo)

                # Enlace e Imagen
                enlace_tag = item.find('a', class_='product-item-link') or item.find('a')
                enlace = enlace_tag['href'] if enlace_tag and enlace_tag.has_attr('href') else ""
                
                imagen_url = ""
                if img_tag:
                    imagen_url = img_tag.get('data-src') or img_tag.get('src') or img_tag.get('data-original') or ""
                if imagen_url.startswith('/'): 
                    base_domain = "/".join(url_base.split("/")[:3])
                    imagen_url = base_domain + imagen_url

                if titulo != "N/A" and titulo != "":
                    productos_lista.append({
                        "URL Origen": url_base,
                        "Rubro": rubro, 
                        "Producto": titulo, 
                        "Codigo": codigo, 
                        "Moneda": moneda,
                        "Precio": valor_numerico,
                        "Imagen": imagen_url, 
                        "Enlace": enlace
                    })
            except Exception:
                continue
        
        # 3. PAGINACIÓN
        next_btn = soup.find('a', class_=lambda c: c and 'next' in c.lower()) or \
                   soup.find('a', title=lambda t: t and 'siguiente' in t.lower()) or \
                   soup.find('a', rel='next')
                   
        if next_btn and next_btn.has_attr('href'):
            siguiente_url = next_btn['href']
            if siguiente_url.startswith('/'):
                base_domain = "/".join(url_base.split("/")[:3])
                url_actual = base_domain + siguiente_url
            else:
                url_actual = siguiente_url
            pagina += 1
        else:
            url_actual = None 

    return productos_lista

@app.get("/", response_class=HTMLResponse)
def index():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.get("/api/status")
def status():
    return {"ok": True, "engine": "fastapi-scraper"}


@app.post("/api/scrape")
def scrape_endpoint(request: ScrapeRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="Falta la URL")

    resultados = ejecutar_scraping(request.url)
    if not resultados:
        # Formato de error compatible con lo que espera ImportarProductos.jsx
        return {"ok": False, "error": "No se encontraron productos en esa URL."}

    # Excel corporativo, tal como lo generaba el motor original
    df = pd.DataFrame(resultados)
    df = df[["URL Origen", "Rubro", "Producto", "Codigo", "Moneda", "Precio", "Imagen", "Enlace"]]
    nombre_archivo = "productos_extraidos.xlsx"
    df.to_excel(nombre_archivo, index=False)
    _ultimo_excel["path"] = str(Path(nombre_archivo).resolve())

    # Normalizamo los campos al contrato que ya usa el frontend (ImportarProductos.jsx):
    # nombre, precio (número), precio_raw, codigo, link, imagen, categoria, fuente, fecha
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M")
    preview = []
    for p in resultados:
        precio_raw = p.get("Precio", "")
        preview.append({
            "nombre":     p.get("Producto", "Sin nombre"),
            "codigo":     p.get("Codigo") if p.get("Codigo") not in (None, "N/A") else "",
            "precio":     _parse_precio(precio_raw),
            "precio_raw": f'{p.get("Moneda","")} {precio_raw}'.strip(),
            "moneda":     p.get("Moneda", "Consultar"),
            "categoria":  p.get("Rubro", ""),
            "link":       p.get("Enlace", ""),
            "imagen":     p.get("Imagen", ""),
            "fuente":     request.url,
            "fecha":      fecha,
        })

    return {
        "ok": True,
        "source": request.url,
        "items": len(preview),
        "preview": preview,
    }


@app.get("/api/export/excel")
def export_excel():
    if not _ultimo_excel["path"] or not Path(_ultimo_excel["path"]).exists():
        raise HTTPException(status_code=404, detail="Sin datos. Ejecutá un scrape primero.")
    fname = f"precios_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return FileResponse(
        _ultimo_excel["path"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=fname,
    )