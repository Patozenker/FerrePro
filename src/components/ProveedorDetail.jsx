import React, { useState, useRef } from 'react'
import { Plus, Trash2, Image, Eye, X } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt, fmtDate, today, nextId } from '../utils'
import { METODOS_PAGO, ESTADO_COLOR } from '../data'
import { Modal, Tabs, TR } from './Shared'

function OPPopup({ pedido, onClose }) {
  const { C, s } = useTheme()
  if (!pedido) return null
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:24, width:460, maxWidth:"95vw" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:700, color:C.white, fontSize:15 }}>OP #{String(pedido.id).padStart(4,"0")}</div>
            <div style={{ fontSize:12, color:C.muted }}>{fmtDate(pedido.fecha)} · <span style={{ color:ESTADO_COLOR[pedido.estado]||C.yellow }}>{pedido.estado}</span></div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer" }}><X size={16}/></button>
        </div>
        <table style={s.table}>
          <thead><tr>{["Producto","SKU","Qty","Costo","Subtotal"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {pedido.items.map((it,i)=>(
              <tr key={i}>
                <td style={s.td}>{it.nombre}</td>
                <td style={{ ...s.td, fontFamily:"monospace", fontSize:11, color:C.muted }}>{it.sku||"—"}</td>
                <td style={{ ...s.td, fontFamily:"monospace", fontWeight:700 }}>{it.qty}</td>
                <td style={{ ...s.td, fontFamily:"monospace" }}>{fmt(it.costo)}</td>
                <td style={{ ...s.td, fontFamily:"monospace", color:C.accent, fontWeight:700 }}>{fmt(it.costo*it.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display:"flex", justifyContent:"flex-end", padding:"12px 0 0", borderTop:`1px solid ${C.border}`, marginTop:4 }}>
          <div style={{ fontFamily:"monospace", fontSize:20, fontWeight:800, color:C.accent }}>{fmt(pedido.total)}</div>
        </div>
        {pedido.nota && <div style={{ marginTop:10, fontSize:12, color:C.muted, background:C.surface, borderRadius:6, padding:"6px 10px" }}>📝 {pedido.nota}</div>}
      </div>
    </div>
  )
}

export default function ProveedorDetailModal({ prov, productos, setProductos, pedidos, setPedidos, pagos, setPagos, historialPrecios, setHistorialPrecios, descuentos, setDescuentos, onClose, cotizacionUSD=1200 }) {
  const { C, s } = useTheme()
  const [tab, setTab]     = useState("pagos")
  const [pf, setPf]       = useState({ fecha:today(), monto:"", metodo:"transferencia", pedidoId:"", nota:"", imagen:null })
  const [precf, setPrecf] = useState({ fecha:today(), prodId:"", precio:"", lista:"", moneda:'ARS' })
  const [df, setDf]       = useState({ nombre:"", tipo:"porcentaje", valor:"", condicion:"siempre", condicionValor:0, activo:true })
  const [opPopup, setOpPopup] = useState(null)
  const [imgModal, setImgModal] = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [recepcionPed, setRecepcionPed] = useState(null) // {pedId, items con qtyRecibida editables}
  const imgRef = useRef()

  // Iniciar recepción inline
  const iniciarRecepcion = (ped) => {
    setRecepcionPed({
      pedId: ped.id,
      items: ped.items.map(i=>({ ...i, recCheck: false, qtyRec: i.qty }))
    })
  }
  const confirmarRecepcion = () => {
    if (!recepcionPed) return
    const ped = peds.find(p=>p.id===recepcionPed.pedId)
    if (!ped) return
    const hayFalt = recepcionPed.items.some(i=>!i.recCheck||i.qtyRec<i.qty)
    const nuevoEstado = hayFalt ? "en_tránsito" : "recibido"
    // Actualizar stock
    if (setProductos) {
      setProductos(prev=>prev.map(prod=>{
        const it=recepcionPed.items.find(i=>i.prodId===prod.id&&i.recCheck)
        return it?{...prod,stock:prod.stock+(it.qtyRec||0)}:prod
      }))
    }
    // Actualizar pedido
    const itemsActualizados = recepcionPed.items.map(i=>({...i,qtyRecibida:i.recCheck?(i.qtyRec||0):0}))
    if (setPedidos) setPedidos(prev=>prev.map(p=>p.id===ped.id?{...p,estado:nuevoEstado,itemsRecibidos:itemsActualizados}:p))
    setRecepcionPed(null)
  }

  const pp    = pagos.filter(x=>x.provId===prov.id)
  const peds  = pedidos.filter(x=>x.proveedorId===prov.id)
  const precs = historialPrecios.filter(x=>x.provId===prov.id)
  const descs = descuentos.filter(x=>x.provId===prov.id)
  const prods = productos.filter(x=>x.provId===prov.id)
  const totalPag  = pp.reduce((a,b)=>a+b.monto,0)
  // Solo OPs recibidas generan deuda — las pendientes/en tránsito están pausadas
  const pedsRecibidos = peds.filter(p=>p.estado==="recibido")
  const pedsPausados  = peds.filter(p=>["pendiente","enviado","en_tránsito"].includes(p.estado))
  const totalComp = pedsRecibidos.reduce((a,b)=>a+b.total,0)
  const totalPausado = pedsPausados.reduce((a,b)=>a+b.total,0)
  const saldoReal = Math.max(0, totalComp - totalPag)

  const handleImgPago = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target.result
      setPf(f=>({...f,imagen:result,imagenNombre:file.name}))
      setImgPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const addPago = () => {
    if (!pf.monto) return
    setPagos(prev=>[...prev,{...pf,id:nextId(prev),provId:prov.id,monto:+pf.monto,pedidoId:pf.pedidoId?+pf.pedidoId:null}])
    setPf({fecha:today(),monto:"",metodo:"transferencia",pedidoId:"",nota:"",imagen:null})
    setImgPreview(null)
  }

  return (
    <Modal title={`${prov.nombre} — Historial`} onClose={onClose} width={820}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        {[
          { label:"Comprado (recibido)", value:fmt(totalComp),    color:C.accent },
          { label:"Pagado",              value:fmt(totalPag),     color:C.green  },
          { label:"Saldo deuda",         value:fmt(saldoReal),    color:saldoReal>0?C.red:C.muted },
          { label:"En curso (pausado)",  value:fmt(totalPausado), color:totalPausado>0?C.yellow:C.muted },
        ].map(k=>(
          <div key={k.label} style={{ padding:"12px 16px", background:C.surface, borderRadius:8, borderLeft:`3px solid ${k.color}` }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:k.color, fontFamily:"monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>
      {totalPausado>0 && (
        <div style={{ background:`${C.yellow}10`,border:`1px solid ${C.yellow}30`,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:C.yellow }}>
          ⏸ Hay {pedsPausados.length} OP(s) en curso por {fmt(totalPausado)} — la deuda se activa cuando sean marcadas como <strong>recibidas</strong>
        </div>
      )}

      <Tabs tabs={[{id:"pagos",label:"Pagos"},{id:"precios",label:"Hist. Precios"},{id:"descuentos",label:"Descuentos"},{id:"ops",label:"OPs"}]} active={tab} onChange={setTab}/>

      {/* PAGOS */}
      {tab==="pagos" && (
        <div>
          <div style={{ ...s.card, marginBottom:16, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.subtle, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Registrar Pago</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <div style={{ flex:"0 0 120px" }}><label style={s.label}>Fecha</label><input style={s.input} type="date" value={pf.fecha} onChange={e=>setPf(f=>({...f,fecha:e.target.value}))}/></div>
              <div style={{ flex:"0 0 130px" }}><label style={s.label}>Monto</label><input style={s.input} type="number" placeholder="0" value={pf.monto} onChange={e=>setPf(f=>({...f,monto:e.target.value}))}/></div>
              <div style={{ flex:"0 0 140px" }}><label style={s.label}>Método</label><select style={s.input} value={pf.metodo} onChange={e=>setPf(f=>({...f,metodo:e.target.value}))}>{METODOS_PAGO.map(m=><option key={m}>{m}</option>)}</select></div>
              <div style={{ flex:"0 0 110px" }}>
                <label style={s.label}>OP vinculada</label>
                <select style={s.input} value={pf.pedidoId} onChange={e=>setPf(f=>({...f,pedidoId:e.target.value}))}>
                  <option value="">—</option>
                  {peds.map(p=><option key={p.id} value={p.id}>#{String(p.id).padStart(4,"0")}</option>)}
                </select>
              </div>
              <div style={{ flex:1, minWidth:120 }}><label style={s.label}>Nota</label><input style={s.input} placeholder="Referencia..." value={pf.nota} onChange={e=>setPf(f=>({...f,nota:e.target.value}))}/></div>
            </div>
            {/* Imagen comprobante */}
            <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
              <button style={{ ...s.btn("ghost"), fontSize:12, padding:"6px 12px" }} onClick={()=>imgRef.current.click()}>
                <Image size={13}/> {imgPreview?"Cambiar imagen":"Adjuntar comprobante"}
              </button>
              <input ref={imgRef} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e=>handleImgPago(e.target.files[0])}/>
              {imgPreview && (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {imgPreview.startsWith('data:application/pdf')
                    ? <button onClick={()=>setImgModal(imgPreview)} style={{ ...s.btn('ghost'),padding:'4px 10px',fontSize:11 }}>📄 {pf.imagenNombre||'PDF'}</button>
                    : <img src={imgPreview} alt="comprobante" style={{ height:36,borderRadius:4,border:`1px solid ${C.border}`,cursor:"pointer" }} onClick={()=>setImgModal(imgPreview)}/>
                  }
                  <button onClick={()=>{setImgPreview(null);setPf(f=>({...f,imagen:null}))}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer" }}><X size={12}/></button>
                  <span style={{ fontSize:11, color:C.muted }}>Click para ampliar</span>
                </div>
              )}
              <button style={{ ...s.btn(), marginLeft:"auto" }} onClick={addPago}><Plus size={14}/> Agregar pago</button>
            </div>
          </div>

          {pp.length===0
            ? <div style={{ textAlign:"center",color:C.muted,padding:32,fontSize:13 }}>Sin pagos registrados</div>
            : <table style={s.table}>
                <thead><tr>{["Fecha","Monto","Método","OP","Nota","Comprobante",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...pp].reverse().map(p=>(
                    <TR key={p.id}>
                      <td style={s.td}>{fmtDate(p.fecha)}</td>
                      <td style={{ ...s.td,fontFamily:"monospace",color:C.green,fontWeight:700 }}>{fmt(p.monto)}</td>
                      <td style={s.td}><span style={s.badge(C.blue)}>{p.metodo}</span></td>
                      <td style={s.td}>
                        {p.pedidoId
                          ? <button onClick={()=>setOpPopup(peds.find(x=>x.id===p.pedidoId))} style={{ ...s.btn("ghost"),padding:"2px 8px",fontSize:11 }}>
                              <Eye size={11}/> #{String(p.pedidoId).padStart(4,"0")}
                            </button>
                          : <span style={{ color:C.muted }}>—</span>
                        }
                      </td>
                      <td style={{ ...s.td,fontSize:12,color:C.muted }}>{p.nota||"—"}</td>
                      <td style={s.td}>
                        {p.imagen
                          ? (p.imagen.startsWith('data:application/pdf') || (p.imagenNombre||'').endsWith('.pdf')
                              ? <button onClick={()=>setImgModal(p.imagen)} style={{ ...s.btn('ghost'),padding:'2px 8px',fontSize:10 }}>📄 PDF</button>
                              : <img src={p.imagen} alt="comp" style={{ height:28,borderRadius:4,border:`1px solid ${C.border}`,cursor:"pointer" }} onClick={()=>setImgModal(p.imagen)}/>)
                          : <span style={{ color:C.muted,fontSize:11 }}>—</span>
                        }
                      </td>
                      <td style={s.td}><button onClick={()=>setPagos(prev=>prev.filter(x=>x.id!==p.id))} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",opacity:0.6 }}><Trash2 size={12}/></button></td>
                    </TR>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* HISTORIAL PRECIOS */}
      {tab==="precios" && (
        <div>
          <div style={{ ...s.card, marginBottom:16, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.subtle, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Registrar Precio</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <div style={{ flex:"0 0 120px" }}><label style={s.label}>Fecha</label><input style={s.input} type="date" value={precf.fecha} onChange={e=>setPrecf(f=>({...f,fecha:e.target.value}))}/></div>
              <div style={{ flex:"0 0 200px" }}><label style={s.label}>Producto</label><select style={s.input} value={precf.prodId} onChange={e=>setPrecf(f=>({...f,prodId:e.target.value}))}><option value="">— Seleccioná —</option>{prods.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
              <div style={{ flex:"0 0 60px" }}>
                <label style={s.label}>Moneda</label>
                <select style={s.input} value={precf.moneda||'ARS'} onChange={e=>setPrecf(f=>({...f,moneda:e.target.value}))}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div style={{ flex:"0 0 110px" }}><label style={s.label}>Precio Costo</label><input style={s.input} type="number" placeholder="0" value={precf.precio} onChange={e=>setPrecf(f=>({...f,precio:e.target.value}))}/></div>
              <div style={{ flex:1, minWidth:120 }}><label style={s.label}>Lista</label><input style={s.input} placeholder="Lista Mar 2026..." value={precf.lista} onChange={e=>setPrecf(f=>({...f,lista:e.target.value}))}/></div>
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <button style={s.btn()} onClick={()=>{
                  if(!precf.prodId||!precf.precio) return
                  const newEntry = {...precf, id:nextId(historialPrecios), provId:prov.id, prodId:+precf.prodId, precio:+precf.precio, moneda:precf.moneda||'ARS'}
                  setHistorialPrecios(prev=>[...prev, newEntry])
                  // Recalcular precio de venta del producto afectado usando el nuevo precio agregado
                  if (setProductos) {
                    setProductos(prev => prev.map(prod => {
                      if (prod.id !== +precf.prodId) return prod
                      // Usar directamente el nuevo precio agregado, no el "más reciente por fecha"
                      const latest = newEntry
                      const moneda = latest.moneda || prod.moneda || 'ARS'
                      const cotizacion = (() => { try { const c=JSON.parse(localStorage.getItem('ferreteria_configAdmin')); return c?.cotizacionUSD||1200 } catch { return 1200 } })()
                      const costoARS = moneda==='USD' ? Math.round(latest.precio * cotizacion) : latest.precio
                      // Usar el margen guardado en el producto (campo margen)
                      // Si no tiene margen guardado, derivarlo del precio actual
                      const margenGuardado = prod.margen
                        || (prod.venta > 0 && costoARS > 0
                            ? Math.round(((prod.venta / costoARS) - 1) * 100)
                            : 30)
                      const newVenta = Math.round(costoARS * (1 + Math.max(0, margenGuardado) / 100))
                      return { ...prod, costo: latest.precio, moneda, margen: margenGuardado, venta: newVenta }
                    }))
                  }
                  setPrecf({fecha:today(),prodId:"",precio:"",lista:"",moneda:'ARS'})
                }}><Plus size={14}/> Agregar</button>
              </div>
            </div>
          </div>
          {prods.map(prod=>{
            const h=precs.filter(x=>x.prodId===prod.id).sort((a,b)=>a.fecha.localeCompare(b.fecha)); if(!h.length) return null
            const varPct=h.length>=2?(((h[h.length-1].precio-h[0].precio)/h[0].precio)*100).toFixed(1):null
            return <div key={prod.id} style={{ ...s.card,marginBottom:12,padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
                <div><div style={{ fontWeight:600,color:C.white,fontSize:13 }}>{prod.nombre}</div><div style={{ fontSize:11,color:C.muted }}>{prod.sku}</div></div>
                {varPct!==null&&<div style={{ fontSize:12,color:+varPct>0?C.red:C.green,fontWeight:600 }}>{+varPct>0?"+":""}{varPct}% total</div>}
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {h.map((e,i)=>{
  const esUSD = (e.moneda||'ARS')==='USD'
  const precioARS = esUSD ? Math.round(e.precio*cotizacionUSD) : e.precio
  const prevARS = i>0 ? ((h[i-1].moneda||'ARS')==='USD' ? Math.round(h[i-1].precio*cotizacionUSD) : h[i-1].precio) : null
  const diff = prevARS !== null ? precioARS - prevARS : 0
  return <div key={e.id} style={{ padding:"6px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}` }}>
    <div style={{ fontSize:10,color:C.muted }}>{fmtDate(e.fecha)}</div>
    {esUSD && <div style={{ fontSize:9,color:'#eab308',fontWeight:700 }}>USD {e.precio}</div>}
    <div style={{ fontFamily:"monospace",fontSize:14,fontWeight:700,color:C.white }}>{fmt(precioARS)}</div>
    {diff!==0&&<div style={{ fontSize:9,color:diff>0?C.red:C.green,fontWeight:600 }}>{diff>0?"+":""}{fmt(diff)}</div>}
    {e.lista&&<div style={{ fontSize:9,color:C.muted }}>{e.lista}</div>}
  </div>
})}
              </div>
            </div>
          })}
          {precs.length===0&&<div style={{ textAlign:"center",color:C.muted,padding:32,fontSize:13 }}>Sin historial registrado</div>}
        </div>
      )}

      {/* DESCUENTOS */}
      {tab==="descuentos" && (
        <div>
          <div style={{ ...s.card,marginBottom:16,padding:16 }}>
            <div style={{ fontSize:12,fontWeight:700,color:C.subtle,marginBottom:10,textTransform:"uppercase",letterSpacing:1 }}>Nuevo Descuento</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              <div style={{ flex:"1 1 180px" }}><label style={s.label}>Nombre</label><input style={s.input} value={df.nombre} onChange={e=>setDf(f=>({...f,nombre:e.target.value}))}/></div>
              <div style={{ flex:"0 0 90px" }}><label style={s.label}>Tipo</label><select style={s.input} value={df.tipo} onChange={e=>setDf(f=>({...f,tipo:e.target.value}))}><option value="porcentaje">%</option><option value="fijo">$ Fijo</option></select></div>
              <div style={{ flex:"0 0 80px" }}><label style={s.label}>Valor</label><input style={s.input} type="number" value={df.valor} onChange={e=>setDf(f=>({...f,valor:e.target.value}))}/></div>
              <div style={{ flex:"0 0 150px" }}><label style={s.label}>Condición</label><select style={s.input} value={df.condicion} onChange={e=>setDf(f=>({...f,condicion:e.target.value}))}><option value="siempre">Siempre</option><option value="qty_min">Cant. mínima</option><option value="pago_rapido">Pronto pago</option><option value="monto_min">Monto mínimo</option></select></div>
              {df.condicion!=="siempre"&&<div style={{ flex:"0 0 80px" }}><label style={s.label}>{df.condicion==="pago_rapido"?"Días":"Valor"}</label><input style={s.input} type="number" value={df.condicionValor} onChange={e=>setDf(f=>({...f,condicionValor:e.target.value}))}/></div>}
              <div style={{ display:"flex",alignItems:"flex-end" }}><button style={s.btn()} onClick={()=>{if(!df.nombre||!df.valor)return;setDescuentos(prev=>[...prev,{...df,id:nextId(prev),provId:prov.id,valor:+df.valor,condicionValor:+df.condicionValor}]);setDf({nombre:"",tipo:"porcentaje",valor:"",condicion:"siempre",condicionValor:0,activo:true})}}><Plus size={14}/> Agregar</button></div>
            </div>
          </div>
          {descs.length===0?<div style={{ textAlign:"center",color:C.muted,padding:32,fontSize:13 }}>Sin descuentos</div>:(
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {descs.map(d=><div key={d.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:d.activo?`${C.green}0a`:C.surface,borderRadius:10,border:`1px solid ${d.activo?C.green+"30":C.border}` }}>
                <div style={{ flex:1 }}><div style={{ fontWeight:600,color:C.white,fontSize:13 }}>{d.nombre}</div><div style={{ fontSize:11,color:C.muted,marginTop:2 }}>{d.condicion==="siempre"?"Siempre":d.condicion==="qty_min"?`Mín. ${d.condicionValor}u`:d.condicion==="pago_rapido"?`Pronto pago ${d.condicionValor}d`:`Monto mín. ${fmt(d.condicionValor)}`}</div></div>
                <span style={{ ...s.badge(C.green),fontSize:14,fontWeight:800 }}>{d.tipo==="porcentaje"?`${d.valor}%`:fmt(d.valor)}</span>
                <button onClick={()=>setDescuentos(prev=>prev.map(x=>x.id===d.id?{...x,activo:!x.activo}:x))} style={{ ...s.btn(d.activo?"green":"ghost"),padding:"4px 10px",fontSize:11 }}>{d.activo?"Activo":"Inactivo"}</button>
                <button onClick={()=>setDescuentos(prev=>prev.filter(x=>x.id!==d.id))} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",opacity:0.6 }}><Trash2 size={13}/></button>
              </div>)}
            </div>
          )}
        </div>
      )}

      {/* OPs */}
      {tab==="ops" && (
        peds.length===0?<div style={{ textAlign:"center",color:C.muted,padding:32,fontSize:13 }}>Sin órdenes de compra</div>:(
          <div>
            {[...peds].reverse().map(p=>{
              const esActiva = ["pendiente","enviado","en_tránsito"].includes(p.estado)
              const recep = recepcionPed?.pedId===p.id
              return (
                <div key={p.id} style={{ marginBottom:12,border:`1px solid ${recep?C.accent:C.border}`,borderRadius:10,overflow:"hidden" }}>
                  {/* Cabecera OP */}
                  <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.surface,flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"monospace",color:C.muted,fontSize:12 }}>#{String(p.id).padStart(4,"0")}</span>
                    <span style={{ fontSize:13,fontWeight:600,color:C.white,flex:1 }}>{fmtDate(p.fecha)}</span>
                    <span style={{ fontFamily:"monospace",color:C.accent,fontWeight:700 }}>{fmt(p.total)}</span>
                    <span style={s.badge(ESTADO_COLOR[p.estado]||C.yellow)}>{p.estado}</span>
                    {esActiva && !recep && (
                      <button onClick={()=>iniciarRecepcion(p)} style={{ ...s.btn("green"),padding:"4px 10px",fontSize:11 }}>
                        ✓ Registrar recepción
                      </button>
                    )}
                    {recep && (
                      <button onClick={()=>setRecepcionPed(null)} style={{ ...s.btn("ghost"),padding:"4px 10px",fontSize:11 }}>Cancelar</button>
                    )}
                    <button onClick={()=>setOpPopup(p)} style={{ ...s.btn("ghost"),padding:"4px 8px",fontSize:11 }}><Eye size={11}/> Ver</button>
                  </div>

                  {/* Tabla items */}
                  <table style={{ ...s.table,margin:0 }}>
                    <thead><tr>
                      {recep && <th style={{ ...s.th,width:36 }}></th>}
                      {["Producto","SKU","Pedido","Recibido","Costo"].map(h=><th key={h} style={s.th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(recep?recepcionPed.items:p.items).map((it,idx)=>{
                        const rec = p.itemsRecibidos?.find(r=>r.prodId===it.prodId)
                        return (
                          <tr key={it.prodId||idx} style={{ background: recep&&it.recCheck?`${C.green}08`:"" }}>
                            {recep && (
                              <td style={{ ...s.td,textAlign:"center" }}>
                                <input type="checkbox" checked={it.recCheck||false}
                                  onChange={()=>setRecepcionPed(prev=>({...prev,items:prev.items.map((x,i2)=>i2===idx?{...x,recCheck:!x.recCheck}:x)}))}
                                  style={{ width:15,height:15,accentColor:C.accent,cursor:"pointer" }}/>
                              </td>
                            )}
                            <td style={{ ...s.td,color:recep&&it.recCheck?C.white:C.subtle }}>{it.nombre}</td>
                            <td style={{ ...s.td,fontFamily:"monospace",fontSize:11,color:C.muted }}>{it.sku||"—"}</td>
                            <td style={{ ...s.td,fontFamily:"monospace",fontWeight:700 }}>{it.qty}</td>
                            <td style={s.td}>
                              {recep ? (
                                <input type="number" min={0} max={it.qty} value={it.qtyRec||0}
                                  disabled={!it.recCheck}
                                  onChange={e=>setRecepcionPed(prev=>({...prev,items:prev.items.map((x,i2)=>i2===idx?{...x,qtyRec:Math.min(it.qty,Math.max(0,+e.target.value||0))}:x)}))}
                                  style={{ ...s.input,width:72,padding:"3px 6px",fontSize:12,fontFamily:"monospace",opacity:it.recCheck?1:0.3,
                                    borderColor:it.recCheck?(it.qtyRec>=it.qty?C.green:C.yellow):C.border }}/>
                              ) : rec ? (
                                <span style={{ fontFamily:"monospace",fontWeight:700,color:rec.qtyRecibida>=it.qty?C.green:C.yellow }}>{rec.qtyRecibida}/{it.qty}</span>
                              ) : (
                                <span style={{ color:C.muted }}>—</span>
                              )}
                            </td>
                            <td style={{ ...s.td,fontFamily:"monospace",fontSize:12,color:C.muted }}>{fmt(it.costo)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Confirmar recepción */}
                  {recep && (
                    <div style={{ padding:"10px 14px",background:`${C.accent}08`,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10 }}>
                      <span style={{ fontSize:12,color:C.muted,alignSelf:"center" }}>
                        {recepcionPed.items.some(i=>!i.recCheck||i.qtyRec<i.qty)?"Recepción parcial — quedará en tránsito":"Recepción completa"}
                      </span>
                      <button onClick={confirmarRecepcion} style={{ ...s.btn("green"),padding:"6px 16px" }}>
                        Confirmar recepción
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {opPopup && <OPPopup pedido={opPopup} onClose={()=>setOpPopup(null)}/>}
      {imgModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}} onClick={()=>setImgModal(null)}>
          <div style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setImgModal(null)} style={{position:"absolute",top:-12,right:-12,background:C.card,border:`1px solid ${C.border}`,borderRadius:"50%",width:28,height:28,cursor:"pointer",color:C.white,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>×</button>
            {imgModal.startsWith("data:application/pdf") || imgModal.endsWith(".pdf")
              ? <object data={imgModal} type="application/pdf" style={{width:"80vw",height:"80vh",borderRadius:8,display:"block"}}><p style={{color:"#fff",padding:20}}>Tu browser no puede mostrar PDF. <a href={imgModal} download style={{color:"#f97316"}}>Descargar</a></p></object>
              : <img src={imgModal} alt="comprobante" style={{maxWidth:"85vw",maxHeight:"85vh",borderRadius:8,display:"block"}}/>
            }
          </div>
        </div>
      )}
    </Modal>
  )
}
