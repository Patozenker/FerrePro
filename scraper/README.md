# 🔧 FerrePro — Scraper Universal de Productos (Standalone + Scroll Infinito)

Herramienta independiente para extraer catálogos web, listas de precios, fotos y códigos de cualquier tienda online y generar un archivo **CSV / Excel** 100% compatible con **FerrePro**.

---

## ⚡ Novedad: Soporte para Scroll Infinito y Páginas Dinámicas (JavaScript)
El scraper ahora cuenta con dos modos:
1. **Modo Estándar (Rápido):** Para sitios con paginación tradicional (Página 1, 2, 3...).
2. **Modo Scroll Infinito (Playwright / Navegador Real):** Para tiendas creadas con React, Vue, Next.js, MercadoLibre o catálogos que cargan más productos a medida que hacés scroll hacia abajo.

---

## 🚀 Formas de Ejecución

### 1. Con Doble Clic (Ventana de Escritorio)
Hacé doble clic en **`ejecutar_scraper.bat`**:
- **Opción 1:** Abre la interfaz gráfica moderna.
- Pegás la URL, marcás la casilla **⚡ Activar modo Scroll Infinito**, elegís la cantidad de scrolls y hacés clic en **🚀 INICIAR EXTRACCIÓN**.
- Al terminar podés abrir el CSV en Excel o la carpeta de guardado con un clic.

### 2. Desde la Terminal / Consola
```bash
cd scraper

# Con Scroll Infinito:
python scraper.py --url "https://tienda-proveedor.com/herramientas" --scroll --scrolls 15 --margin 50 --prov "Distribuidora Centro"

# Con Paginación tradicional:
python scraper.py --url "https://tienda-proveedor.com/herramientas" --pages 3 --margin 50
```

---

## 📊 Columnas del CSV Generado

| Columna | Descripción |
|---|---|
| `sku` | Código de artículo o SKU extraído |
| `nombre` | Título del producto |
| `categoria` | Rubro o categoría detectada |
| `costo` | Precio base extraído de la web |
| `venta` | Precio de venta calculado con tu margen % |
| `stock` | Stock inicial asignado |
| `minStock` | Alerta de stock mínimo |
| `foto` | URL de la imagen en alta resolución |
| `descripcion` | Descripción del producto |
| `moneda` | ARS o USD |
| `proveedor` | Nombre del proveedor |
| `enlace` | URL original de la publicación |

---

## 📥 ¿Cómo importar el archivo en FerrePro?
1. Abrí **FerrePro** ([ferrepro.netlify.app](https://ferrepro.netlify.app/)).
2. Andá a **Inventario > Importar**.
3. Arrastrá el archivo `.csv` generado y confirmá con **Importar Productos**.