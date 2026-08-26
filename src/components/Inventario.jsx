import React, { useState, useMemo, useRef } from 'react'
import { Search, Plus, Pencil, Trash2, CheckCircle2, Upload, ChevronUp, ChevronDown,
         Image as ImageIcon, X, CheckSquare, Square, ZoomIn } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { CATS_DEFAULT } from '../data'
import { nextId, fmt, today } from '../utils'
import { Modal, FF, StockBadge, TR } from './Shared'
import ImportarProductos from './ImportarProductos'

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ src, nombre, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex',
               alignItems:'center', justifyContent:'center', zIndex:9999, cursor:'zoom-out' }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
        <img src={src} alt={nombre}
          style={{ maxWidth:'88vw', maxHeight:'85vh', objectFit:'contain',
                   borderRadius:12, boxShadow:'0 8px 40px rgba(0,0,0,0.8)' }}/>
        <button onClick={onClose}
          style={{ position:'absolute', top:-14, right:-14, background:'#fff', border:'none',
                   borderRadius:'50%', width:32, height:32, cursor:'pointer', display:'flex',
                   alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.4)' }}>
          <X size={16} color="#000"/>
        </button>
        {nombre && (
          <div style={{ position:'absolute', bottom:-36, left:0, right:0, textAlign:'center',
                        color:'#fff', fontSize:13, fontWeight:500 }}>{nombre}</div>
        )}
      </div>
    </div>
  )
}

export default function Inventario({ productos, setProductos, proveedores, categoriasExtra,
  setCategoriasExtra, editProdId, setEditProdId, historialPrecios, setHistorialPrecios, allCats: allCatsFromApp, cotizacionUSD=1200 }) {
  const { C, s } = useTheme()
  const allCats = allCatsFromApp || [...CATS_DEFAULT, ...(categoriasExtra||[])]

  // ── Funciones de precio ─────────────────────────────────────────────────
  // El precio de venta SIEMPRE se calcula: costoARS * (1 + margen%)
  // costo y moneda vienen del historial (más reciente). margen es el % guardado en el producto.

  const getLatestHistorial = (prodId) => {
    if (!historialPrecios?.length) return null
    const entries = historialPrecios.filter(h => h.prodId === prodId)
      .sort((a, b) => b.id - a.id) // Ordenar por ID descendente (más reciente agregado primero)
    return entries.length ? entries[0] : null
  }

  // Devuelve el costo efectivo en ARS usando historial o fallback
  const getCostoARS = (prod, cotiz) => {
    const ct = cotiz || cotizacionUSD
    const hist = getLatestHistorial(prod.id)
    if (hist) {
      return (hist.moneda || prod.moneda || 'ARS') === 'USD'
        ? Math.round(hist.precio * ct)
        : hist.precio
    }
    return (prod.moneda || 'ARS') === 'USD' ? Math.round(prod.costo * ct) : prod.costo
  }

  // Calcula el precio de venta dado un costo en ARS y un margen %
  const calcVentaFromCosto = (costoARS, margenPct) =>
    Math.round((costoARS || 0) * (1 + (+margenPct || 0) / 100))

  // Recalcula el precio de venta de un producto usando historial + margen guardado
  const recalcVenta = (prod, cotiz) => {
    const margen = prod.margen ?? 0
    if (!margen) return prod.venta  // sin margen guardado, no tocar
    return calcVentaFromCosto(getCostoARS(prod, cotiz), margen)
  }
  const imgRef      = useRef()
  const bulkImgRef  = useRef()

  // ── Estado ────────────────────────────────────────────────────────────────
  const [search, setSearch]         = useState("")
  const [catFilter, setCatFilter]   = useState("Todos")
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState({})
  const [showImport, setShowImport] = useState(false)
  const [sortCol, setSortCol]       = useState("nombre")
  const [sortDir, setSortDir]       = useState("asc")
  const [ganancia, setGanancia]     = useState("")
  const [quickEdit, setQuickEdit]   = useState(null)
  const [viewMode, setViewMode]     = useState("table") // "table" | "grid"

  // Auto-generate SKU: first 3 letters of category + sequential 5-digit number
  const generateSKU = (cat) => {
    const prefix = (cat||'GEN').replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,3).padEnd(3,'X')
    const existing = productos.filter(p => p.sku && p.sku.toUpperCase().startsWith(prefix+'-'))
    const maxNum = existing.reduce((max, p) => {
      const num = parseInt(p.sku.split('-')[1]) || 0
      return Math.max(max, num)
    }, 0)
    return `${prefix}-${String(maxNum+1).padStart(5,'0')}`
  }
  const [selected, setSelected]     = useState(new Set())   // ids seleccionados
  const [lightbox, setLightbox]     = useState(null)        // { src, nombre }

  // ── Foto individual ───────────────────────────────────────────────────────
  const handleFotoChange = (file, onDone) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const img = new window.Image()
      img.onload = () => {
        const MAX = 400
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        onDone(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  // ── Editar / abrir producto ────────────────────────────────────────────────
  React.useEffect(() => {
    if (editProdId) {
      const p = productos.find(x=>x.id===editProdId)
      if (p) {
        setForm({...p})
        if (p.margen) setGanancia(String(p.margen))
        setModal({mode:"edit",item:p})
      }
      setEditProdId && setEditProdId(null)
    }
  }, [editProdId])

  // ── Ordenamiento ──────────────────────────────────────────────────────────
  const toggleSort = (col) => {
    if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc")
    else { setSortCol(col); setSortDir("asc") }
  }
  const SortIcon = ({col}) => sortCol!==col
    ? <ChevronUp size={10} style={{ opacity:0.2 }}/>
    : sortDir==="asc" ? <ChevronUp size={11} color={C.accent}/> : <ChevronDown size={11} color={C.accent}/>

  const filtered = useMemo(()=>{
    let res=productos.filter(p=>(catFilter==="Todos"||p.cat===catFilter)
      &&(p.nombre.toLowerCase().includes(search.toLowerCase())||(p.sku||"").toLowerCase().includes(search.toLowerCase())))
    const dir=sortDir==="asc"?1:-1
    res.sort((a,b)=>{
      const av=sortCol==="margen"?(a.costo>0?(a.venta-a.costo)/a.costo:0):(a[sortCol]||"")
      const bv=sortCol==="margen"?(b.costo>0?(b.venta-b.costo)/b.costo:0):(b[sortCol]||"")
      return typeof av==="string"?av.localeCompare(bv)*dir:(av-bv)*dir
    })
    return res
  },[productos,search,catFilter,sortCol,sortDir])

  // ── Guardar producto ──────────────────────────────────────────────────────
  const save = () => {
    if (!form.nombre) return
    const margenVal = +ganancia || form.margen || 0
    const mon = form.moneda || 'ARS'
    const costoARS = mon === 'USD' ? Math.round(+form.costo * cotizacionUSD) : +form.costo
    const ventaCalc = margenVal > 0 ? Math.round(costoARS * (1 + margenVal / 100)) : +form.venta
    const p = { ...form, margen: margenVal, costo:+form.costo, venta: ventaCalc, stock:+form.stock, minStock:+form.minStock, provId:+form.provId }
    if (modal.mode === 'add') {
      setProductos(prev => [...prev, { ...p, id: nextId(prev) }])
    } else {
      const original = modal.item
      // Registrar en historial si cambió el costo
      if (setHistorialPrecios && +form.costo !== +original.costo) {
        setHistorialPrecios(ph => [...ph, {
          id: nextId(ph),
          provId: p.provId,
          prodId: original.id,
          fecha: today(),
          precio: +form.costo,
          moneda: form.moneda || 'ARS',
          lista: 'Edición manual'
        }])
      }
      setProductos(prev => prev.map(x => x.id === original.id ? { ...x, ...p } : x))
    }
    setModal(null); setGanancia('')
  }

  const handleImport = (nuevos, listaName) => {
    const ahora = today()
    setProductos(prev=>{
      let next=[...prev]; const maxId=Math.max(0,...next.map(x=>x.id))
      nuevos.forEach((p,i)=>{
        const dup=next.find(x=>x.sku&&x.sku===p.sku)
        if(dup){
          if(p.costo && p.costo!==dup.costo && setHistorialPrecios){
            setHistorialPrecios(ph=>[...ph,{id:nextId(ph),provId:p.provId||dup.provId,prodId:dup.id,
              fecha:ahora,precio:p.costo,lista:listaName||"Lista importada"}])
          }
          next=next.map(x=>x.sku===p.sku?{...x,costo:p.costo||x.costo,venta:p.venta||x.venta}:x)
        } else {
          next.push({...p,id:maxId+i+1})
        }
      })
      return next
    })
  }

  // ── Multi-selección ───────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p=>p.id)))
  }
  const clearSelection = () => setSelected(new Set())

  const duplicateProduct = (p) => {
    const newCat = p.cat || allCats[0] || 'GEN'
    const newSKU = generateSKU(newCat)
    const dup = { ...p, id: nextId(productos), sku: newSKU, nombre: p.nombre + ' (copia)' }
    setProductos(prev => [...prev, dup])
    // Open edit modal for the new product
    setForm({ ...dup })
    setGanancia(dup.margen ? String(dup.margen) : '')
    setModal({ mode: 'edit', item: dup })
  }

  const bulkDelete = () => {
    if (!confirm(`¿Eliminar ${selected.size} producto(s)? Esta acción no se puede deshacer.`)) return
    setProductos(prev=>prev.filter(p=>!selected.has(p.id)))
    clearSelection()
  }

  const bulkFoto = (file) => {
    handleFotoChange(file, (foto) => {
      setProductos(prev=>prev.map(p=>selected.has(p.id) ? {...p,foto} : p))
      clearSelection()
    })
  }

  const SortTH=({col,label})=>(
    <th style={{ ...s.th,cursor:"pointer",userSelect:"none" }} onClick={()=>toggleSort(col)}>
      <span style={{ display:"inline-flex",alignItems:"center",gap:3 }}>{label}<SortIcon col={col}/></span>
    </th>
  )

  // Recalcular venta en el form a partir del costo/moneda/margen actuales
  const calcVentaForm = (costo, pct, moneda) => {
    // Fórmula simple y directa: lo que el usuario escribe es lo que cuenta
    const g = +pct || 0
    const c = +costo || 0
    if (g <= 0 || c <= 0) return
    const mon = moneda || form.moneda || 'ARS'
    const costoARS = mon === 'USD' ? Math.round(c * cotizacionUSD) : c
    const venta = Math.round(costoARS * (1 + g / 100))
    setForm(f => ({ ...f, margen: g, venta }))
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div>
      {/* Lightbox */}
      {lightbox && <Lightbox src={lightbox.src} nombre={lightbox.nombre} onClose={()=>setLightbox(null)}/>}

      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>Inventario</h1>
          <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>{productos.length} productos · {productos.filter(p=>p.stock<=p.minStock).length} alertas</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button style={s.btn("ghost")} onClick={()=>setShowImport(true)}><Upload size={13}/> Importar</button>
          <button style={s.btn("ghost")} onClick={()=>setViewMode(v=>v==="table"?"grid":"table")}>
            {viewMode==="table"?"▦":"☰"} {viewMode==="table"?"Grid":"Tabla"}
          </button>
          <button style={s.btn()} onClick={()=>{const initCat=allCats[0]||'GEN';const initSKU=generateSKU(initCat);setForm({sku:initSKU,nombre:'',cat:initCat,cats:[initCat],costo:0,margen:50,stock:0,minStock:5,provId:proveedores[0]?.id,foto:null,moneda:'ARS',ivaTasa:21,ivaIncluido:true});setGanancia("");setModal({mode:"add"})}}><Plus size={14}/> Nuevo</button>
        </div>
      </div>

      {/* Barra de acción masiva */}
      {selected.size > 0 && (
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:`${C.accent}15`,
                      border:`1px solid ${C.accent}40`,borderRadius:10,marginBottom:12,flexWrap:"wrap" }}>
          <span style={{ fontSize:13,fontWeight:700,color:C.accent }}>{selected.size} producto(s) seleccionado(s)</span>
          <div style={{ display:"flex",gap:8,marginLeft:8 }}>
            <button style={{ ...s.btn("ghost"),fontSize:12,padding:"5px 12px" }} onClick={()=>bulkImgRef.current.click()}>
              <ImageIcon size={13}/> Asignar foto a todos
            </button>
            <select style={{ ...s.input,fontSize:12,padding:"5px 10px",width:'auto' }}
              defaultValue="" onChange={e=>{
                const cat=e.target.value; if(!cat) return
                if(!confirm(`¿Cambiar categoría de ${selected.size} producto(s) a "${cat}"?`)) return
                setProductos(prev=>prev.map(p=>selected.has(p.id)?{...p,cat}:p))
                clearSelection()
              }}>
              <option value="">Cambiar categoría...</option>
              {allCats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select style={{ ...s.input,fontSize:12,padding:"5px 10px",width:'auto' }}
              defaultValue="" onChange={e=>{
                const iv=e.target.value; if(!iv) return
                const tasa = parseFloat(iv)
                if(!confirm(`¿Cambiar IVA de ${selected.size} producto(s) a ${iv==='0'?'Consumidor Final':iv+'%'}?`)) return
                setProductos(prev=>prev.map(p=>selected.has(p.id)?{...p,ivaTasa:tasa,ivaIncluido:tasa>0}:p))
                clearSelection()
              }}>
              <option value="">Cambiar IVA...</option>
              <option value="0">Consumidor Final (0%)</option>
              <option value="10.5">10.5%</option>
              <option value="21">21%</option>
            </select>
            <select style={{ ...s.input,fontSize:12,padding:"5px 10px",width:'auto' }}
              defaultValue="" onChange={e=>{
                const mon=e.target.value; if(!mon) return
                if(!confirm(`¿Cambiar moneda de ${selected.size} producto(s) a ${mon}?`)) return
                setProductos(prev=>prev.map(p=>selected.has(p.id)?{...p,moneda:mon}:p))
                clearSelection()
              }}>
              <option value="">Cambiar moneda...</option>
              <option value="ARS">$ ARS</option>
              <option value="USD">USD</option>
            </select>
            <button style={{ ...s.btn("danger"),fontSize:12,padding:"5px 12px" }} onClick={bulkDelete}>
              <Trash2 size={13}/> Eliminar seleccionados
            </button>
            <button style={{ ...s.btn("ghost"),fontSize:12,padding:"5px 10px" }} onClick={clearSelection}>
              <X size={13}/> Cancelar
            </button>
          </div>
          <input ref={bulkImgRef} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e=>bulkFoto(e.target.files[0])}/>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:"flex",gap:10,marginBottom:12,flexWrap:"wrap" }}>
        <div style={{ position:"relative",flex:1,maxWidth:300 }}>
          <Search size={13} style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted }}/>
          <input style={{ ...s.input,paddingLeft:28 }} placeholder="Nombre o SKU..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div style={{ display:"flex",gap:5,flexWrap:"wrap",alignItems:"center" }}>
          {["Todos",...allCats].map(c=>(
            <div key={c} style={{ display:'flex',alignItems:'center',gap:0 }}>
              <button onClick={()=>setCatFilter(c)} style={{ ...s.pill(catFilter===c),fontSize:11,borderRadius:c==='Todos'?undefined:'6px 0 0 6px' }}>{c}</button>
              {c!=='Todos' && (
                <button
                  title={`Eliminar categoría "${c}"`}
                  onClick={e=>{
                    e.stopPropagation()
                    if(!confirm(`¿Eliminar la categoría "${c}"? Los productos con esta categoría quedarán sin categoría asignada.`)) return
                    setCategoriasExtra(prev=>prev.filter(x=>x!==c))
                    if(catFilter===c) setCatFilter('Todos')
                  }}
                  style={{ background:'transparent',border:`1px solid ${C.border}`,borderLeft:'none',borderRadius:'0 6px 6px 0',padding:'3px 5px',cursor:'pointer',color:C.muted,display:'flex',alignItems:'center' }}
                  onMouseEnter={e=>{e.currentTarget.style.color=C.red;e.currentTarget.style.borderColor=C.red}}
                  onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}>
                  <X size={9}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vista Grid / Cards */}
      {viewMode === "grid" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12 }}>
          {filtered.map(p => {
            const m = p.margen ?? 0
            const ventaCalc = recalcVenta(p, cotizacionUSD)
            const handleClick = () => { setForm({...p}); setGanancia(p.margen ? String(p.margen) : ""); setModal({mode:"edit",item:p}) }
            return (
              <div key={p.id} onClick={handleClick} style={{ ...s.card, padding:12, cursor:"pointer", transition:"transform 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                {/* Imagen */}
                <div style={{ height:140, borderRadius:8, overflow:"hidden", marginBottom:10, background:C.surface,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {(p.foto || p.imagen)
                    ? <img src={p.foto || p.imagen} alt={p.nombre} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    : <ImageIcon size={40} color={C.muted}/>
                  }
                </div>
                {/* Info */}
                <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{p.sku}</div>
                <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:8, lineHeight:1.3,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nombre}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                  <div>
                    <div style={{ fontSize:10, color:C.muted }}>Costo</div>
                    <div style={{ fontFamily:"monospace", fontWeight:600, color:C.white }}>{fmt(getCostoARS(p, cotizacionUSD))}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:C.muted }}>Venta</div>
                    <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:800, color:C.accent }}>{fmt(ventaCalc)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:11, color:m>=50?C.green:m>=30?C.yellow:C.red, fontWeight:600 }}>{m}%</span>
                  <span style={{ fontSize:12, fontWeight:700, color:p.stock<=p.minStock?C.yellow:C.green }}>{p.stock} u.</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabla */}
      {viewMode === "table" && (
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>
            <th style={{ ...s.th,width:36,cursor:"pointer" }} onClick={selectAll}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center" }}>
                {allSelected
                  ? <CheckSquare size={15} color={C.accent}/>
                  : <Square size={15} color={C.muted}/>}
              </div>
            </th>
            <th style={s.th}></th>
            <SortTH col="sku" label="SKU"/>
            <SortTH col="nombre" label="Producto"/>
            <SortTH col="costo" label="Costo"/>
            <SortTH col="margen" label="Margen"/>
            <SortTH col="venta" label="Venta"/>
            <th style={s.th}>IVA</th>
            <SortTH col="stock" label="Stock"/>
            <th style={s.th}>Estado</th>
            <th style={s.th}></th>
          </tr></thead>
          <tbody>
            {filtered.map(p=>{
              const costoARS = (p.moneda||'ARS')==='USD' ? Math.round((p.costo||0)*cotizacionUSD) : (p.costo||0)
              const ventaCalc = (p.margen && costoARS) ? Math.round(costoARS*(1+p.margen/100)) : p.venta
              const m=costoARS>0?(((p.venta-costoARS)/costoARS)*100).toFixed(0):0
              const isSel = selected.has(p.id)
              return <TR key={p.id} style={{ background: isSel ? `${C.accent}10` : undefined }}>
                {/* Checkbox */}
                <td style={{ ...s.td,width:36,textAlign:"center",cursor:"pointer" }} onClick={()=>toggleSelect(p.id)}>
                  {isSel
                    ? <CheckSquare size={15} color={C.accent}/>
                    : <Square size={15} color={C.muted}/>}
                </td>
                {/* Foto */}
                <td style={{ ...s.td, width:44, padding:'6px 8px' }}>
                  {(p.foto || p.imagen)
                    ? <div style={{ position:'relative', width:36, height:36 }}>
                        <img src={p.foto || p.imagen} alt="" style={{ width:36, height:36, objectFit:'cover', borderRadius:6,
                          border:`1px solid ${C.border}`, cursor:'zoom-in', display:'block' }}
                          onClick={()=>setLightbox({ src: p.foto || p.imagen, nombre: p.nombre })}/>
                        <div style={{ position:'absolute',inset:0,borderRadius:6,display:'flex',alignItems:'center',
                          justifyContent:'center',background:'rgba(0,0,0,0)',transition:'background 0.15s',cursor:'zoom-in' }}
                          onClick={()=>setLightbox({ src: p.foto || p.imagen, nombre: p.nombre })}
                          onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,0.35)'}}
                          onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)'}}>
                          <ZoomIn size={13} color="#fff" style={{ opacity:0,transition:'opacity 0.15s' }}
                            ref={el=>{if(el)el.closest('div').onmouseenter=ev=>{el.style.opacity=1};if(el)el.closest('div').onmouseleave=ev=>{el.style.opacity=0}}}/>
                        </div>
                      </div>
                    : <div style={{ width:36, height:36, borderRadius:6, border:`1px dashed ${C.border}`,
                        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                        onClick={()=>{setForm({...p});setGanancia(p.margen?String(p.margen):"");setModal({mode:"edit",item:p})}}>
                        <ImageIcon size={14} color={C.muted}/>
                      </div>
                  }
                </td>
                <td style={{ ...s.td,fontFamily:"monospace",fontSize:11,color:C.muted }}>{p.sku||"—"}</td>
                <td style={{ ...s.td,fontWeight:500,color:C.white }}>{p.nombre}</td>
                <td style={{ ...s.td,fontFamily:"monospace" }}>
                  {p.moneda==='USD'
                    ? <div>
                        <span style={{fontSize:10,color:C.yellow,fontWeight:700}}>USD {p.costo}</span>
                        <div style={{fontSize:10,color:C.muted}}>≈ {fmt(Math.round(p.costo*cotizacionUSD))}</div>
                      </div>
                    : fmt(p.costo)}
                </td>
                <td style={{ ...s.td,padding:'4px 6px' }}>
                  {(() => {
                    const isEditing = quickEdit === p.id
                    if (isEditing) return (
                      <input
                        type="number" autoFocus
                        defaultValue={m}
                        style={{ ...s.input, width:68, padding:'4px 8px', fontFamily:'monospace', fontSize:12, color:C.accent }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            const pct = +e.target.value || 0
                            if (pct > 0) {
                              const base = (p.moneda||'ARS')==='USD' ? Math.round((p.costo||0)*cotizacionUSD) : (p.costo||0)
                              const newVenta = Math.round(base * (1 + pct / 100))
                              setProductos(prev => prev.map(x => x.id===p.id ? {...x, margen:pct, venta:newVenta} : x))
                            }
                            setQuickEdit(null)
                          }
                          if (e.key === 'Escape') setQuickEdit(null)
                        }}
                        onBlur={e => {
                          const pct = +e.target.value || 0
                          if (pct > 0) {
                            const base = (p.moneda||'ARS')==='USD' ? Math.round((p.costo||0)*cotizacionUSD) : (p.costo||0)
                            const newVenta = Math.round(base * (1 + pct / 100))
                            setProductos(prev => prev.map(x => x.id===p.id ? {...x, margen:pct, venta:newVenta} : x))
                          }
                          setQuickEdit(null)
                        }}
                      />
                    )
                    return (
                      <span
                        title="Click para editar % ganancia rápido"
                        onClick={() => setQuickEdit(p.id)}
                        style={{ fontFamily:'monospace', color:+m>=50?C.green:+m>=30?C.yellow:C.red, fontWeight:600,
                          cursor:'pointer', padding:'2px 6px', borderRadius:4, display:'inline-block',
                          border:`1px solid transparent` }}
                        onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${C.border}`}}
                        onMouseLeave={e=>{e.currentTarget.style.border='1px solid transparent'}}>
                        {m}%
                      </span>
                    )
                  })()}
                </td>
                <td style={{ ...s.td,fontFamily:"monospace",color:C.accent,fontWeight:600 }}>{fmt(ventaCalc)}</td>
                <td style={s.td}>
                  {(() => {
                    const iva = p.ivaTasa ?? (p.ivaIncluido !== false ? 21 : 0)
                    if (iva === 0) return <span style={{fontSize:10,color:C.muted}}>CF</span>
                    return <span style={{fontSize:11,fontFamily:'monospace',color:iva===21?C.blue:C.yellow}}>{iva}%</span>
                  })()}
                </td>
                <td style={{ ...s.td,fontFamily:"monospace",fontWeight:700 }}>{p.stock}</td>
                <td style={s.td}><StockBadge stock={p.stock} min={p.minStock}/></td>
                <td style={s.td}><div style={{ display:"flex",gap:4 }}>
                  <button onClick={()=>{setForm({...p});setGanancia(p.margen?String(p.margen):"");setModal({mode:"edit",item:p})}}
                    title="Editar" style={{ background:"none",border:"none",color:C.subtle,cursor:"pointer",padding:4 }}><Pencil size={13}/></button>
                  <button onClick={()=>duplicateProduct(p)}
                    title="Duplicar producto" style={{ background:"none",border:"none",color:C.blue,cursor:"pointer",padding:4 }}>⧉</button>
                  <button onClick={()=>{if(confirm("¿Eliminar?"))setProductos(prev=>prev.filter(x=>x.id!==p.id))}}
                    style={{ background:"none",border:"none",color:C.red,cursor:"pointer",padding:4,opacity:0.6 }}><Trash2 size={13}/></button>
                </div></td>
              </TR>
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Modal edición/creación */}
      {modal&&(
        <Modal title={modal.mode==="add"?"Nuevo Producto":"Editar Producto"} onClose={()=>setModal(null)}>
          <div style={s.grid(2)}>
            <FF label="SKU"><input style={s.input} value={form.sku||""} onChange={e=>setForm(f=>({...f,sku:e.target.value}))}/></FF>
            <FF label="Categoría">
            <select style={s.input} value={form.cat||''} onChange={e=>{
              const newCat=e.target.value
              // Auto-regen SKU if it looks like it was auto-generated
              const prefix=(form.cat||'').replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,3).padEnd(3,'X')
              const autoPattern = new RegExp(`^${prefix}-\\d{5}$`)
              const newSku = autoPattern.test(form.sku||'') ? generateSKU(newCat) : form.sku
              setForm(f=>({...f,cat:newCat,newSku}))
            }}>{allCats.map(c=><option key={c}>{c}</option>)}</select>
          </FF>
          </div>
          <FF label="Nombre"><input style={s.input} value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></FF>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 2fr', gap:10, marginBottom:14 }}>
            <div>
              <label style={s.label}>Costo</label>
              <div style={{ display:'flex', gap:3 }}>
                <select style={{ ...s.input, width:60, flexShrink:0, paddingLeft:4, paddingRight:2, fontSize:11 }}
                  value={form.moneda||'ARS'} onChange={e=>{setForm(f=>({...f,moneda:e.target.value}));if(ganancia&&form.costo)calcVentaForm(form.costo,ganancia,e.target.value)}}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
                <input style={{...s.input,flex:1}} type="number" value={form.costo||0} onChange={e=>{setForm(f=>({...f,costo:+e.target.value}));if(ganancia)calcVentaForm(e.target.value,ganancia,form.moneda)}}/>
              </div>
              {(() => {
                const hist = modal?.item?.id ? getLatestHistorial(modal.item.id) : null
                const costoRef = hist ? hist.precio : +form.costo
                const monedaRef = hist ? (hist.moneda||'ARS') : (form.moneda||'ARS')
                const costoARS = monedaRef==='USD' ? Math.round(costoRef*cotizacionUSD) : costoRef
                return (
                  <div style={{fontSize:10,marginTop:3}}>
                    {hist && hist.precio !== +form.costo && (
                      <span style={{color:C.yellow}}>📋 Historial: {monedaRef==='USD'?'USD ':''}{fmt(hist.precio)} </span>
                    )}
                    {(form.moneda==='USD'||monedaRef==='USD') && (
                      <span style={{color:C.muted}}>≈ {fmt(costoARS)} ARS</span>
                    )}
                  </div>
                )
              })()}
            </div>
            <div>
              <label style={s.label}>% Gan.</label>
              <input style={{ ...s.input,borderColor:ganancia?C.accent:C.border,fontSize:13 }} type="number" placeholder="50" value={ganancia}
                onChange={e=>{setGanancia(e.target.value);calcVentaForm(form.costo,e.target.value)}}/>
            </div>
            <div>
              <label style={s.label}>Precio Venta</label>
              <input style={{ ...s.input,color:C.accent,fontWeight:700 }} type="number" value={form.venta||0}
                onChange={e=>{setForm(f=>({...f,venta:+e.target.value}));setGanancia("")}}/>
            </div>
          </div>
          {form.costo>0&&form.venta>0&&(()=>{
  const costoBase = form.moneda==='USD' ? Math.round(+form.costo*cotizacionUSD) : +form.costo
  const margen = (((+form.venta-costoBase)/costoBase)*100).toFixed(1)
  const ganUnit = +form.venta - costoBase
  return <div style={{ fontSize:12,color:C.green,marginBottom:8,marginTop:-8 }}>Margen: {margen}% · Ganancia unit.: {fmt(ganUnit)}</div>
})()}
          <div style={{ padding:'10px 12px',background:C.surface,borderRadius:8,marginBottom:12,border:`1px solid ${C.border}` }}>
            <label style={s.label}>IVA</label>
            <div style={{ display:'flex',gap:6 }}>
              {[{v:0,l:'Consumidor Final (0%)'},{v:10.5,l:'10.5%'},{v:21,l:'21%'}].map(opt=>(
                <button key={opt.v} onClick={()=>setForm(f=>({...f,ivaTasa:opt.v,ivaIncluido:opt.v>0}))}
                  style={{ flex:1, padding:'6px 4px', fontSize:11, fontWeight:600, borderRadius:7, border:`1px solid ${(form.ivaTasa??21)===opt.v?C.accent:C.border}`,
                    background:(form.ivaTasa??21)===opt.v?C.accentDim:'transparent',
                    color:(form.ivaTasa??21)===opt.v?C.accent:C.muted, cursor:'pointer' }}>
                  {opt.v===0 ? 'C. Final' : opt.v+'%'}
                </button>
              ))}
            </div>
            {(form.ivaTasa??21)>0 && (form.venta||0)>0 && (
              <div style={{ fontSize:11,color:C.muted,marginTop:6 }}>
                {(() => {
                  const tasa = form.ivaTasa ?? 21
                  const sinIva = Math.round((form.venta||0)/(1+tasa/100))
                  const ivaAmt = (form.venta||0)-sinIva
                  return `Sin IVA: ${fmt(sinIva)} · IVA ${tasa}%: ${fmt(ivaAmt)}`
                })()}
              </div>
            )}
          </div>
          <div style={s.grid(2)}>
            <FF label="Stock Actual"><input style={s.input} type="number" value={form.stock||0} onChange={e=>setForm(f=>({...f,stock:+e.target.value}))}/></FF>
            <FF label="Stock Mínimo"><input style={s.input} type="number" value={form.minStock||5} onChange={e=>setForm(f=>({...f,minStock:+e.target.value}))}/></FF>
          </div>
          <FF label="Proveedor"><select style={s.input} value={form.provId||""} onChange={e=>setForm(f=>({...f,provId:+e.target.value}))}>{proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></FF>

          {/* Foto */}
          <div style={{ marginTop:4 }}>
            <label style={s.label}>Foto del producto</label>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              {(form.foto || form.imagen)
                ? <>
                    <img src={form.foto || form.imagen} alt="" onClick={()=>setLightbox({src: form.foto || form.imagen, nombre: form.nombre})}
                      style={{ width:72, height:72, objectFit:'cover', borderRadius:8,
                        border:`1px solid ${C.border}`, cursor:'zoom-in' }}/>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <button style={{ ...s.btn('ghost'), fontSize:12, padding:'5px 10px' }} onClick={()=>imgRef.current.click()}>
                        <ImageIcon size={12}/> Cambiar foto
                      </button>
                      <button style={{ ...s.btn('danger'), fontSize:12, padding:'5px 10px' }} onClick={()=>setForm(f=>({...f, foto: null, imagen: null}))}>
                        <X size={12}/> Quitar foto
                      </button>
                    </div>
                  </>
                : <div onClick={()=>imgRef.current.click()}
                    style={{ width:72, height:72, borderRadius:8, border:`2px dashed ${C.border}`,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      gap:4, cursor:'pointer', background:C.surface }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <ImageIcon size={20} color={C.muted}/>
                    <span style={{ fontSize:10, color:C.muted }}>Subir foto</span>
                  </div>
              }
            </div>
            <input ref={imgRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e=>handleFotoChange(e.target.files[0], foto=>setForm(f=>({...f,foto})))}/>
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:8 }}>
            <button style={s.btn("ghost")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={s.btn()} onClick={save}><CheckCircle2 size={14}/> Guardar</button>
          </div>
        </Modal>
      )}

      {/* Modal importar */}
      {showImport&&(
        <div style={s.modal} onClick={()=>setShowImport(false)}>
          <div onClick={e=>e.stopPropagation()}>
            <ImportarProductos onImport={handleImport} onClose={()=>setShowImport(false)}
              proveedores={proveedores} categoriasExtra={allCats} setCategoriasExtra={setCategoriasExtra}/>
          </div>
        </div>
      )}
    </div>
  )
}
