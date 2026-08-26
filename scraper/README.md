# 🔧 FerrePro — Scraper Universal de Productos (Standalone)

Herramienta independiente para extraer catálogos web, listas de precios, fotos y códigos de cualquier tienda online y generar un archivo **CSV / Excel** 100% compatible con **FerrePro**.

---

## 🚀 Formas de Ejecución

### 1. Con Doble Clic (Más fácil)
Hacé doble clic en **`ejecutar_scraper.bat`**:
- **Opción 1:** Abre una ventana visual donde pegás la URL, elegís las páginas y hacés clic en *Iniciar Extracción*.
- **Opción 2:** Ejecuta el asistente interactivo en la terminal.

### 2. Desde la Terminal / Consola
```bash
cd scraper

# Modo interactivo paso a paso:
python scraper.py

# Modo directo por parámetros:
python scraper.py --url "https://tienda-proveedor.com/herramientas" --pages 3 --margin 50 --prov "Distribuidora Centro"
```

---

## 📊 Estructura del CSV Generado
El archivo `.csv` (y `.xlsx`) generado contiene exactamente las columnas requeridas por FerrePro:

| Columna | Descripción |
|---|---|
| `sku` | Código de artículo o SKU extraído (o autogenerado `IMP-0001`) |
| `nombre` | Título del producto limpio |
| `categoria` | Rubro o categoría detectada |
| `costo` | Precio base extraído de la web |
| `venta` | Precio de venta sugerido (calculado con el margen de ganancia configurado) |
| `stock` | Stock inicial sugerido (default: 10) |
| `minStock` | Alerta de stock mínimo (default: 3) |
| `foto` | Enlace directo a la imagen en alta calidad |
| `descripcion` | Descripción del producto |
| `moneda` | ARS o USD |
| `proveedor` | Nombre del proveedor asignado |
| `enlace` | URL original del producto |

---

## 📥 ¿Cómo importar el archivo en FerrePro?
1. Abrí **FerrePro** ([ferrepro.netlify.app](https://ferrepro.netlify.app/) o local).
2. Andá a la sección **Inventario**.
3. Hacé clic en el botón **Importar** (arriba a la derecha).
4. Arrastrá el archivo `.csv` generado o seleccionalo con el botón de subir.
5. Verificá la vista previa y confirmá con **Importar Productos**. ¡Listo!