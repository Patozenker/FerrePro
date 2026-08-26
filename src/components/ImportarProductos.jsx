import React, { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Camera, Globe, X, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { nextId } from '../utils'
import * as XLSX from 'xlsx'

const MAPEO_COLS = {
  nombre:   ["nombre","producto","descripcion","description","name","articulo","item","detalle"],
  sku:      ["sku","codigo","code","cod","ref","referencia","id","art","articulo"],
  costo:    ["costo","cost","precio_compra","compra","precio costo","coste","p.costo","p costo"],
  venta:    ["venta","precio","price","pvp","precio_venta","precio venta","sell","p.venta","p venta","lista"],
  stock:    ["stock","cantidad","qty","quantity","existencia","existencias","cant","saldo"],
  minStock: ["min","minimo","stock_minimo","min_stock","stock minimo","alerta","punto pedido"],
  cat:      ["categoria","category","cat","rubro","tipo","type","familia","linea"],
}

function detectarCol(headers, campo) {
  const keys = MAPEO_COLS[campo]
  for (const h of headers) {
    const norm = h.toLowerCase().trim()
    if (keys.some(k => norm === k || norm.includes(k))) return h
  }
  return null
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/[^0-9.,\-]/g, '').replace(',', '.')
  return parseFloat(s) || 0
}

export default function ImportarProductos({ onImport, onClose, proveedores, categoriasExtra, setCategoriasExtra }) {
  const { C, s } = useTheme()
  const [tab, setTab]           = useState("excel")
  const [preview, setPreview]   = useState([])
  const [errors, setErrors]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [mapeo, setMapeo]       = useState({})
  const [headers, setHeaders]   = useState([])
  const [rawRows, setRawRows]   = useState([])
  const [provId, setProvId]     = useState(proveedores[0]?.id || 1)
  const [newCat, setNewCat]     = useState("")
  const [listaName, setListaName] = useState("")
  const [bulkCat, setBulkCat]     = useState("")
  const fileRef = useRef()
  const imgRef  = useRef()

  const allCats = [...(categoriasExtra || [])]

  const buildPreview = (rows, hdrs, mp, cats) => {
    const errs = []
    const items = rows.slice(0, 500).map((row, i) => {
      const get = campo => {
        const col = mp[campo] || detectarCol(hdrs, campo)
        return col ? (row[col] ?? '') : ''
      }
      const nombre = String(get("nombre")).trim()
      if (!nombre || nombre === '0') { if (i < 50) errs.push(`Fila ${i+2}: sin nombre`); return null }
      const costo  = parseNum(get("costo"))
      const venta  = parseNum(get("venta"))
      const catRaw = String(get("cat")).trim()
      // buscar cat en lista o usar como está si no está vacía
      const catMatch = cats.find(c => catRaw.toLowerCase().includes(c.toLowerCase().slice(0,4)))
      const cat = catMatch || (catRaw && catRaw !== '0' ? catRaw : cats[0])
      return {
        _id: i,
        sku:      String(get("sku")).trim() || `IMP-${String(i+1).padStart(3,"0")}`,
        nombre,
        cat,
        costo,
        venta:    venta > 0 ? venta : costo > 0 ? Math.round(costo * 1.6) : 0,
        stock:    parseInt(get("stock")) || 0,
        minStock: parseInt(get("minStock")) || 5,
        provId:   +provId,
        _ok: true,
      }
    }).filter(Boolean)
    setPreview(items)
    setErrors(errs.slice(0, 5))
    return items
  }

  const handleExcel = async (file) => {
    if (!file) return
    setLoading(true)
    setErrors([])
    setPreview([])
    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      // sheet_to_json más robusto que header:1 para CSVs con comas en strings
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
      if (data.length < 2) { setErrors(["Archivo vacío o sin datos"]); setLoading(false); return }
      // encontrar fila de headers (puede no ser la primera)
      let hdrRow = 0
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i].map(String)
        if (row.some(c => MAPEO_COLS.nombre.some(k => c.toLowerCase().includes(k)))) { hdrRow = i; break }
      }
      const hdrs = data[hdrRow].map(c => String(c).trim()).filter(Boolean)
      const rows = data.slice(hdrRow + 1)
        .filter(r => r.some(c => c !== '' && c !== null && c !== undefined))
        .map(r => { const o = {}; hdrs.forEach((h, i) => { o[h] = r[i] ?? '' }); return o })
      setHeaders(hdrs)
      setRawRows(rows)
      const mp = {}
      Object.keys(MAPEO_COLS).forEach(campo => { const c = detectarCol(hdrs, campo); if (c) mp[campo] = c })
      setMapeo(mp)
      buildPreview(rows, hdrs, mp, allCats)
    } catch(e) {
      setErrors([`Error leyendo archivo: ${e.message}`])
    }
    setLoading(false)
  }

  const handleCSV = async (file) => {
    // CSV: leer como texto y parsear manualmente
    setLoading(true)
    setErrors([])
    try {
      const text = await file.text()
      // detectar separador
      const sep = text.includes(';') ? ';' : ','
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { setErrors(["CSV vacío"]); setLoading(false); return }
      const hdrs = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g,''))
      const rows = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g,''))
        const o = {}; hdrs.forEach((h, i) => { o[h] = cols[i] || '' }); return o
      })
      setHeaders(hdrs)
      setRawRows(rows)
      const mp = {}
      Object.keys(MAPEO_COLS).forEach(campo => { const c = detectarCol(hdrs, campo); if (c) mp[campo] = c })
      setMapeo(mp)
      buildPreview(rows, hdrs, mp, allCats)
    } catch(e) { setErrors([`Error leyendo CSV: ${e.message}`]) }
    setLoading(false)
  }

  const handleFile = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'csv') handleCSV(file)
    else handleExcel(file)
  }

  const handleImg = async (file) => {
    if (!file) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setPreview([
      { _id:0, sku:"IMG-001", nombre:"Producto de imagen — editá el nombre", cat:allCats[0], costo:0, venta:0, stock:0, minStock:5, provId:+provId, _ok:true },
      { _id:1, sku:"IMG-002", nombre:"Producto de imagen 2 — editá el nombre", cat:allCats[0], costo:0, venta:0, stock:0, minStock:5, provId:+provId, _ok:true },
    ])
    setErrors(["La detección por imagen requiere edición manual. Completá nombre, costo y precio de venta."])
    setLoading(false)
  }

  // URL configurable del scraper (por defecto puerto 8005 o variable de entorno)
  const SCRAPER_URL = import.meta.env.VITE_SCRAPER_URL || 'http://127.0.0.1:8005'

  // Convierte "1.234,56" / "94.745,19" / "" -> número. app.py manda el precio como texto crudo.
  const parsePrecioScraper = (raw) => {
    if (!raw) return 0
    let s = String(raw).trim()
    if (!s) return 0
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'')
    } else if (s.includes(',')) {
      const dec = s.split(',')[1]
      s = (dec && dec.length <= 2) ? s.replace(',', '.') : s.replace(/,/g,'')
    } else if (s.includes('.')) {
      const dec = s.split('.')[1]
      if (dec && dec.length === 3) s = s.replace(/\./g,'')
    }
    const n = parseFloat(s.replace(/[^\d.]/g,''))
    return isNaN(n) ? 0 : n
  }

  const handleURL = async () => {
    if (!urlInput.trim()) return
    setLoading(true)
    setErrors([])
    try {
      const res = await fetch(`${SCRAPER_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
        signal: AbortSignal.timeout(45000),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const detail = data?.detail
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d=>d.msg).join(', ')
          : `HTTP ${res.status}`
        throw new Error(msg)
      }
      const productos = data?.productos || []
      if (!productos.length) throw new Error('No se encontraron productos en esa URL')

      const items = productos.map((p, i) => {
        const precioNum = parsePrecioScraper(p.Precio)
        return {
          _id: i,
          sku: (p.Codigo && p.Codigo !== 'N/A') ? p.Codigo : `WEB-${String(i+1).padStart(3,'0')}`,
          nombre: p.Producto || 'Sin nombre',
          cat: p.Rubro ? (allCats.find(c=>p.Rubro.toLowerCase().includes(c.toLowerCase().slice(0,4)))||allCats[0]) : allCats[0],
          costo: precioNum,
          venta: precioNum ? Math.round(precioNum * 1.5) : 0,
          stock: 0,
          minStock: 5,
          provId: +provId,
          _ok: true,
          _link: p.Enlace || '',
          _imagen: p.Imagen || '',
          _moneda: p.Moneda || '',
        }
      })
      setPreview(items)
      setErrors([`✓ ${items.length} productos importados desde ${urlInput}. Revisá precios (moneda: ${items[0]?._moneda||'—'}) y categorías antes de confirmar.`])
    } catch(e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        setErrors(['⚠ El scraper tardó demasiado. Probá con una URL de categoría más chica o reintentá.'])
      } else if (e.message?.includes('fetch') || e.name === 'TypeError') {
        setErrors([`⚠ No se pudo conectar al servidor de scraping. Si estás en la web/Netlify, usá la pestaña 'Excel / CSV' para importar listas directo en el navegador.`])
      } else {
        setErrors([`Error: ${e.message}`])
      }
    }
    setLoading(false)
  }

  const updateField = (id, field, val) => {
    setPreview(prev => prev.map(p => p._id===id
      ? { ...p, [field]: ["costo","venta","stock","minStock"].includes(field) ? +val : val }
      : p))
  }

  const removeRow = (id) => setPreview(prev => prev.filter(p => p._id !== id))

  const addNewCat = () => {
    const c = newCat.trim()
    if (!c || allCats.includes(c)) return
    setCategoriasExtra(prev => [...(prev||[]), c])
    setNewCat("")
  }

  const agregarFila = () => {
    const id = Math.max(0, ...preview.map(p=>p._id)) + 1
    setPreview(prev => [...prev, { _id:id, sku:`IMP-${String(id+1).padStart(3,"0")}`, nombre:"", cat:allCats[0], costo:0, venta:0, stock:0, minStock:5, provId:+provId, _ok:true }])
  }

  const confirmar = () => {
    const validos = preview.filter(p => p.nombre.trim())
    if (!validos.length) return
    onImport(validos, listaName||"Lista importada")
    onClose()
  }

  const inputStyle = { ...s.input, padding:"5px 8px", fontSize:12 }

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:28, width:960, maxWidth:"97vw", maxHeight:"94vh", overflow:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:C.white }}>Importar Productos</h3>
          <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>Excel · CSV · Foto · Web — editá antes de confirmar</p>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer" }}><X size={18}/></button>
      </div>

      {/* Categorías */}
      <div style={{ ...s.card, padding:12, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, color:C.subtle, fontWeight:600, whiteSpace:"nowrap" }}>Categorías disponibles:</span>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1 }}>
            {allCats.map(c => <span key={c} style={s.badge(C.blue)}>{c}</span>)}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <input style={{ ...s.input, width:150, padding:"5px 10px", fontSize:12 }} placeholder="Nueva categoría..." value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addNewCat()}/>
            <button style={{ ...s.btn("ghost"), padding:"5px 10px", fontSize:12 }} onClick={addNewCat}><Plus size={12}/> Agregar</button>
          </div>
        </div>
      </div>

      {/* Lista name + bulk cat */}
      <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <label style={s.label}>Nombre de la lista (para historial de precios)</label>
          <input style={s.input} placeholder="Lista Mar 2026..." value={listaName} onChange={e=>setListaName(e.target.value)}/>
        </div>
        <div style={{ flex:"0 0 200px" }}>
          <label style={s.label}>Cambiar categoría a todos</label>
          <div style={{ display:"flex", gap:6 }}>
            <select style={s.input} value={bulkCat} onChange={e=>setBulkCat(e.target.value)}>
              <option value="">— mantener —</option>
              {allCats.map(c=><option key={c}>{c}</option>)}
            </select>
            <button style={{ ...s.btn("ghost"), padding:"8px 10px", flexShrink:0 }} onClick={()=>{ if(bulkCat) setPreview(p=>p.map(x=>({...x,cat:bulkCat}))) }}>✓</button>
          </div>
        </div>
      </div>

      {/* Tabs + Proveedor */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        {[
          { id:"excel", icon:FileSpreadsheet, label:"Excel / CSV" },
          { id:"foto",  icon:Camera,          label:"Foto / PDF"  },
          { id:"web",   icon:Globe,           label:"Desde web"   },
          { id:"manual",icon:Plus,            label:"Manual"      },
        ].map(t => (
          <button key={t.id} onClick={()=>{ setTab(t.id); setPreview([]); setErrors([]) }}
            style={{ ...s.btn(tab===t.id?"primary":"ghost") }}>
            <t.icon size={13}/> {t.label}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}>Proveedor por defecto</span>
          <select style={{ ...s.input, width:180 }} value={provId} onChange={e=>setProvId(+e.target.value)}>
            {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* EXCEL / CSV */}
      {tab==="excel" && (
        <div>
          <div
            onClick={()=>fileRef.current.click()}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=C.accent}}
            onDragLeave={e=>{e.currentTarget.style.borderColor=C.border}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor=C.border;handleFile(e.dataTransfer.files[0])}}
            style={{ border:`2px dashed ${C.border}`, borderRadius:12, padding:36, textAlign:"center", cursor:"pointer", marginBottom:12 }}>
            <Upload size={28} color={C.muted} style={{ marginBottom:8 }}/>
            <div style={{ fontSize:14, color:C.subtle, fontWeight:600 }}>Arrastrá o hacé click para subir</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>.xlsx · .xls · .csv — hasta 500 productos</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])}/>
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>
            <strong style={{ color:C.subtle }}>Columnas reconocidas:</strong> nombre/producto · sku/codigo · costo/precio_compra · venta/precio/lista · stock/cantidad · categoria/rubro · min/minimo
          </div>
          {/* Mapeo */}
          {headers.length > 0 && rawRows.length > 0 && (
            <div style={{ ...s.card, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.subtle, marginBottom:10 }}>Mapeo de columnas — ajustá si el auto-mapeo no fue correcto</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {Object.keys(MAPEO_COLS).map(campo => (
                  <div key={campo}>
                    <label style={{ ...s.label, textTransform:"capitalize" }}>{campo==="minStock"?"Stock mínimo":campo}</label>
                    <select style={s.input} value={mapeo[campo]||""} onChange={e=>{const nm={...mapeo,[campo]:e.target.value};setMapeo(nm);buildPreview(rawRows,headers,nm,allCats)}}>
                      <option value="">— ninguna —</option>
                      {headers.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOTO */}
      {tab==="foto" && (
        <div onClick={()=>imgRef.current.click()} style={{ border:`2px dashed ${C.border}`, borderRadius:12, padding:36, textAlign:"center", cursor:"pointer", marginBottom:12 }}>
          <Camera size={28} color={C.muted} style={{ marginBottom:8 }}/>
          <div style={{ fontSize:14, color:C.subtle, fontWeight:600 }}>Subí foto de lista de precios o PDF</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Se generan filas editables — completá los datos</div>
          <input ref={imgRef} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e=>handleImg(e.target.files[0])}/>
        </div>
      )}

      {/* WEB */}
      {tab==="web" && (
        <div style={{ marginBottom:12 }}>
          <div style={{ padding:"8px 12px",background:`${C.blue}15`,border:`1px solid ${C.blue}30`,borderRadius:8,marginBottom:12,fontSize:12,color:C.blue }}>
            Requiere el servidor de scraping corriendo: <code style={{ background:C.surface,padding:"1px 6px",borderRadius:4 }}>uvicorn app:app --reload --port 8000</code>
          </div>
          <label style={s.label}>URL de la categoría/listado de productos del proveedor</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input style={{...s.input, flex:1}} placeholder="https://proveedor.com/categoria-productos" value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleURL()}/>
            <button style={s.btn()} onClick={handleURL} disabled={loading}>{loading ? "..." : "Importar"}</button>
          </div>
          <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Recorre automáticamente la paginación del sitio hasta traer todo el catálogo de esa categoría.</div>
        </div>
      )}

      {/* MANUAL */}
      {tab==="manual" && preview.length===0 && (
        <div style={{ textAlign:"center", padding:24 }}>
          <button style={s.btn()} onClick={()=>{setPreview([{_id:0,sku:"",nombre:"",cat:allCats[0],costo:0,venta:0,stock:0,minStock:5,provId:+provId,_ok:true}])}}>
            <Plus size={14}/> Crear tabla vacía
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:"center", padding:28, color:C.muted }}>
          <div style={{ width:24,height:24,border:`3px solid ${C.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 10px" }}/>
          Procesando archivo...
        </div>
      )}

      {/* Errores */}
      {errors.length>0 && (
        <div style={{ background:`${C.yellow}10`,border:`1px solid ${C.yellow}30`,borderRadius:8,padding:10,marginBottom:12 }}>
          {errors.map((e,i)=><div key={i} style={{ fontSize:12,color:C.yellow }}><AlertTriangle size={11} style={{ display:"inline",marginRight:4 }}/>{e}</div>)}
        </div>
      )}

      {/* Preview */}
      {preview.length>0 && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ fontSize:13,color:C.subtle }}><strong style={{ color:C.white }}>{preview.length}</strong> productos para importar</div>
            <div style={{ display:"flex",gap:8 }}>
              <button style={{ ...s.btn("ghost"),fontSize:12,padding:"6px 12px" }} onClick={agregarFila}><Plus size={12}/> Agregar fila</button>
              <button style={s.btn()} onClick={confirmar}><CheckCircle2 size={14}/> Confirmar {preview.filter(p=>p.nombre.trim()).length} productos</button>
            </div>
          </div>
          <div style={{ overflowX:"auto",maxHeight:340,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:8 }}>
            <table style={{ ...s.table,minWidth:800 }}>
              <thead style={{ position:"sticky",top:0,background:C.card,zIndex:1 }}>
                <tr>{["SKU","Nombre *","Categoría","Costo","P. Venta","Stock","Mín",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map(p=>(
                  <tr key={p._id} style={{ background: !p.nombre.trim() ? `${C.red}08` : "" }}>
                    <td style={s.td}><input style={{ ...inputStyle,width:90 }} value={p.sku} onChange={e=>updateField(p._id,"sku",e.target.value)}/></td>
                    <td style={s.td}><input style={{ ...inputStyle,width:200 }} value={p.nombre} onChange={e=>updateField(p._id,"nombre",e.target.value)} placeholder="Nombre del producto *"/></td>
                    <td style={s.td}>
                      <select style={{ ...inputStyle,width:130 }} value={p.cat} onChange={e=>updateField(p._id,"cat",e.target.value)}>
                        {allCats.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={s.td}><input style={{ ...inputStyle,width:80 }} type="number" value={p.costo} onChange={e=>updateField(p._id,"costo",e.target.value)}/></td>
                    <td style={s.td}><input style={{ ...inputStyle,width:80 }} type="number" value={p.venta} onChange={e=>updateField(p._id,"venta",e.target.value)}/></td>
                    <td style={s.td}><input style={{ ...inputStyle,width:60 }} type="number" value={p.stock} onChange={e=>updateField(p._id,"stock",e.target.value)}/></td>
                    <td style={s.td}><input style={{ ...inputStyle,width:55 }} type="number" value={p.minStock} onChange={e=>updateField(p._id,"minStock",e.target.value)}/></td>
                    <td style={s.td}><button onClick={()=>removeRow(p._id)} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",opacity:0.6 }}><Trash2 size={13}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex",justifyContent:"flex-end",marginTop:12 }}>
            <button style={s.btn()} onClick={confirmar}><CheckCircle2 size={14}/> Confirmar — importar {preview.filter(p=>p.nombre.trim()).length} productos</button>
          </div>
        </div>
      )}
    </div>
  )
}
