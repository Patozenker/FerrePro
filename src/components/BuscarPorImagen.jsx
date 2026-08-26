import React, { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, Search, Package, Truck, Loader, ImageIcon, ZoomIn, Key } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt } from '../utils'
import { StockBadge } from './Shared'

export default function BuscarPorImagen({ productos, proveedores, onEditarProducto }) {
  const { C, s } = useTheme()
  const [imagen, setImagen]       = useState(null) // base64
  const [preview, setPreview]     = useState(null) // URL para mostrar
  const [buscando, setBuscando]   = useState(false)
  const [resultado, setResultado] = useState(null) // { termino, descripcion, resProductos, resProveedores }
  const [error, setError]         = useState(null)
  const [dragging, setDragging]   = useState(false)
  const [zoomImg, setZoomImg]     = useState(false)
  const [apiKey, setApiKey]       = useState(() => {
    try {
      return localStorage.getItem('ferreteria_claude_api_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || ''
    } catch { return '' }
  })
  const [showKeyInput, setShowKeyInput] = useState(false)
  const fileRef = useRef()

  const handleSaveKey = (k) => {
    setApiKey(k)
    try { localStorage.setItem('ferreteria_claude_api_key', k) } catch {}
  }

  const cargarImagen = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const b64 = e.target.result.split(',')[1]
      setImagen({ data: b64, type: file.type })
      setPreview(e.target.result)
      setResultado(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    cargarImagen(file)
  }, [])

  const onDragOver = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const buscar = async () => {
    if (!imagen) return
    const effectiveKey = apiKey.trim()
    if (!effectiveKey) {
      setShowKeyInput(true)
      setError('Para buscar por imagen con IA ingresá una clave de API de Anthropic (Claude).')
      return
    }

    setBuscando(true)
    setError(null)
    setResultado(null)

    try {
      // 1. Identificar el producto con Claude Vision
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: imagen.type, data: imagen.data }
              },
              {
                type: 'text',
                text: `Sos un asistente para una ferretería argentina. Analizá la imagen y respondé SOLO con un JSON válido (sin texto extra, sin backticks) con este formato:
{
  "termino": "palabra clave corta del producto (ej: martillo, tornillo, pintura)",
  "descripcion": "descripción breve del producto visto en la imagen (1-2 oraciones)",
  "sinonimos": ["lista", "de", "palabras", "clave", "alternativas"]
}

Si no es un producto de ferretería o no podés identificarlo, respondé:
{"termino": null, "descripcion": "No se pudo identificar un producto de ferretería.", "sinonimos": []}`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message || `Error ${response.status} de Anthropic`)
      }
      const text = data.content?.map(b => b.text || '').join('') || ''

      let parsed
      try {
        const clean = text.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(clean)
      } catch {
        throw new Error('No se pudo interpretar la respuesta de la IA.')
      }

      if (!parsed.termino) {
        setResultado({ termino: null, descripcion: parsed.descripcion, resProductos: [], resProveedores: [] })
        setBuscando(false)
        return
      }

      // 2. Buscar en inventario propio
      const palabras = [parsed.termino, ...(parsed.sinonimos || [])].map(p => p.toLowerCase())

      const matchProducto = (nombre) => {
        const n = nombre.toLowerCase()
        return palabras.some(p => n.includes(p))
      }

      const resProductos = productos.filter(p => matchProducto(p.nombre))

      // 3. Buscar en catálogos de proveedores (por nombre de categoría y productos asociados)
      // Cruzamos proveedores con productos que matcheen y mostramos el proveedor + sus productos
      const provConProductos = proveedores.map(prov => {
        const prodsDelProv = productos.filter(p => p.provId === prov.id && matchProducto(p.nombre))
        return { ...prov, productosMatch: prodsDelProv }
      }).filter(pv => pv.productosMatch.length > 0)

      setResultado({
        termino: parsed.termino,
        descripcion: parsed.descripcion,
        resProductos,
        resProveedores: provConProductos,
      })
    } catch (err) {
      setError('Ocurrió un error al procesar la imagen: ' + err.message)
    }

    setBuscando(false)
  }

  const limpiar = () => {
    setImagen(null)
    setPreview(null)
    setResultado(null)
    setError(null)
  }

  const totalResultados = resultado
    ? resultado.resProductos.length + resultado.resProveedores.reduce((a, p) => a + p.productosMatch.length, 0)
    : 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.white }}>Buscar por Imagen</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
            Subí una foto de un producto y encontramos todo lo que tenés en stock y con proveedores
          </p>
        </div>
        <button
          onClick={() => setShowKeyInput(!showKeyInput)}
          style={{ ...s.btn('ghost'), fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          title="Configurar clave de Claude Vision"
        >
          <Key size={14} color={apiKey ? C.green : C.muted} />
          {apiKey ? 'API Key configurada' : 'Configurar API Key'}
        </button>
      </div>

      {showKeyInput && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Clave de Anthropic Claude Vision</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Para identificar productos por foto se utiliza la API de Anthropic Claude. Tu clave se guarda únicamente en tu navegador.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="password"
              placeholder="sk-ant-api..."
              value={apiKey}
              onChange={e => handleSaveKey(e.target.value)}
              style={{ ...s.input, flex: 1, marginBottom: 0 }}
            />
            <button style={s.btn()} onClick={() => setShowKeyInput(false)}>Listo</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: preview ? '380px 1fr' : '1fr', gap: 20, alignItems: 'start' }}>

        {/* Panel izquierdo: subir imagen */}
        <div>
          {/* Drop zone */}
          {!preview ? (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileRef.current.click()}
              style={{
                background: dragging ? C.accentDim : C.card,
                border: `2px dashed ${dragging ? C.accent : C.border}`,
                borderRadius: 16,
                padding: 48,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                cursor: 'pointer',
                transition: 'all 0.2s',
                minHeight: 280,
              }}
            >
              <div style={{ background: C.accentDim, borderRadius: '50%', padding: 20 }}>
                <ImageIcon size={36} color={C.accent} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>
                  Arrastrá una imagen o hacé clic
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  JPG, PNG, WEBP — foto de un producto de ferretería
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btn(), pointerEvents: 'none' }}>
                  <Upload size={13} /> Subir imagen
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
              {/* Preview */}
              <div style={{ position: 'relative' }}>
                <img
                  src={preview}
                  alt="producto"
                  style={{ width: '100%', maxHeight: 280, objectFit: 'contain', background: '#000', cursor: 'zoom-in' }}
                  onClick={() => setZoomImg(true)}
                />
                <button
                  onClick={limpiar}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                >
                  <X size={14} />
                </button>
                <button
                  onClick={() => setZoomImg(true)}
                  style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#fff', fontSize: 11 }}
                >
                  <ZoomIn size={12} /> Ver
                </button>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  style={{ ...s.btn(), justifyContent: 'center', opacity: buscando ? 0.7 : 1 }}
                  onClick={buscar}
                  disabled={buscando}
                >
                  {buscando
                    ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analizando imagen...</>
                    : <><Search size={14} /> Buscar este producto</>
                  }
                </button>
                <button
                  style={{ ...s.btn('ghost'), justifyContent: 'center', fontSize: 12 }}
                  onClick={() => fileRef.current.click()}
                >
                  <Upload size={12} /> Cambiar imagen
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => cargarImagen(e.target.files[0])}
          />

          {/* Descripción del resultado */}
          {resultado?.descripcion && (
            <div style={{ background: C.accentDim, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                🤖 Producto identificado
              </div>
              <div style={{ fontSize: 13, color: C.white, fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>
                {resultado.termino || '—'}
              </div>
              <div style={{ fontSize: 12, color: C.subtle }}>
                {resultado.descripcion}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 12, padding: 14, marginTop: 14, fontSize: 13, color: C.red }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Panel derecho: resultados */}
        {resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Sin resultados */}
            {!resultado.termino && (
              <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>No se identificó el producto</div>
                <div style={{ fontSize: 13, color: C.muted }}>{resultado.descripcion}</div>
              </div>
            )}

            {resultado.termino && totalResultados === 0 && (
              <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>Sin resultados</div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  No encontramos "<strong>{resultado.termino}</strong>" en tu inventario ni en ningún proveedor.
                </div>
              </div>
            )}

            {/* Inventario propio */}
            {resultado.resProductos.length > 0 && (
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Package size={16} color={C.accent} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>Tu inventario</span>
                  <span style={{ ...s.badge(C.accent), marginLeft: 4 }}>{resultado.resProductos.length}</span>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['SKU', 'Producto', 'Categoría', 'Precio Venta', 'Stock', 'Estado'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.resProductos.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => onEditarProducto && onEditarProducto(p.id)}
                        style={{ cursor: onEditarProducto ? 'pointer' : 'default' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{p.sku || '—'}</td>
                        <td style={{ ...s.td, fontWeight: 600, color: C.white }}>{p.nombre}</td>
                        <td style={s.td}><span style={s.badge(C.blue)}>{p.cat}</span></td>
                        <td style={{ ...s.td, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{fmt(p.venta)}</td>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700 }}>{p.stock}</td>
                        <td style={s.td}><StockBadge stock={p.stock} min={p.minStock} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Por proveedor */}
            {resultado.resProveedores.length > 0 && (
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Truck size={16} color={C.blue} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>En proveedores</span>
                  <span style={{ ...s.badge(C.blue), marginLeft: 4 }}>
                    {resultado.resProveedores.reduce((a, p) => a + p.productosMatch.length, 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {resultado.resProveedores.map(prov => (
                    <div key={prov.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: `${C.blue}10` }}>
                        <div style={{ background: `${C.blue}22`, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: C.blue }}>
                          {prov.nombre}
                        </div>
                        <span style={{ fontSize: 12, color: C.muted }}>{prov.contacto} · {prov.tel}</span>
                      </div>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            {['SKU', 'Producto', 'Costo', 'Precio Venta', 'Stock'].map(h => (
                              <th key={h} style={s.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {prov.productosMatch.map(p => (
                            <tr key={p.id}>
                              <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{p.sku || '—'}</td>
                              <td style={{ ...s.td, fontWeight: 500, color: C.white }}>{p.nombre}</td>
                              <td style={{ ...s.td, fontFamily: 'monospace' }}>{fmt(p.costo)}</td>
                              <td style={{ ...s.td, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{fmt(p.venta)}</td>
                              <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 700 }}>{p.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal zoom imagen */}
      {zoomImg && preview && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'zoom-out' }}
          onClick={() => setZoomImg(false)}
        >
          <img src={preview} alt="zoom" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}
