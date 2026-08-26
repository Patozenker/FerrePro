import React, { useState, useMemo } from 'react'
import { Plus, X, Eye, AlertTriangle, MessageCircle, Mail, ClipboardList, CheckSquare, Square, Send } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt, fmtDate, today, nextId } from '../utils'
import { ESTADOS_PEDIDO, ESTADO_COLOR } from '../data'
import { StockBadge, TR } from './Shared'

function RecepcionModal({ pedido, onClose, onGuardar }) {
  const { C, s } = useTheme()
  const [recibidos, setRecibidos] = useState(
    Object.fromEntries(pedido.items.map(i => [i.prodId, { check: false, qty: i.qty }]))
  )

  const faltantes = pedido.items.filter(i => !recibidos[i.prodId]?.check || recibidos[i.prodId].qty < i.qty)
  const hayFaltantes = faltantes.length > 0
  const buildMsgFaltantes = () => {
    const lines = faltantes.map(i => {
      const recQty = recibidos[i.prodId]?.qty || 0
      const falta  = i.qty - recQty
      return `• ${i.nombre} — faltan ${falta} u. (pedidas ${i.qty}, recibidas ${recQty})`
    })
    return `⚠ Recepción parcial OP #${String(pedido.id).padStart(4,"0")}\n\nFaltan los siguientes artículos:\n${lines.join("\n")}\n\nPor favor confirmar fecha de entrega.`
  }

  const confirmar = () => {
    const itemsActualizados = pedido.items.map(i => ({
      ...i, qtyRecibida: recibidos[i.prodId]?.check ? (recibidos[i.prodId].qty || i.qty) : 0
    }))
    onGuardar(itemsActualizados, hayFaltantes ? "en_tránsito" : "recibido")
    onClose()
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200 }} onClick={onClose}>
      <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:24,width:600,maxWidth:"95vw",maxHeight:"90vh",overflow:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:700,color:C.white,fontSize:16 }}>Recepción OP #{String(pedido.id).padStart(4,"0")}</div>
            <div style={{ fontSize:12,color:C.muted,marginTop:2 }}>Tildá lo que llegó y ajustá las cantidades</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer" }}><X size={18}/></button>
        </div>

        <table style={s.table}>
          <thead><tr><th style={{ ...s.th,width:36 }}></th>{["Producto","Pedido","Recibido"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {pedido.items.map(item => {
              const r = recibidos[item.prodId]
              const completo = r.check && r.qty >= item.qty
              return (
                <tr key={item.prodId} style={{ background: r.check ? `${C.green}08` : "" }}>
                  <td style={{ ...s.td,textAlign:"center" }}>
                    <button onClick={()=>setRecibidos(p=>({...p,[item.prodId]:{...p[item.prodId],check:!p[item.prodId].check}}))} style={{ background:"none",border:"none",cursor:"pointer",color:r.check?C.green:C.muted }}>
                      {r.check ? <CheckSquare size={18}/> : <Square size={18}/>}
                    </button>
                  </td>
                  <td style={{ ...s.td,fontWeight:500,color:r.check?C.white:C.muted }}>{item.nombre}</td>
                  <td style={{ ...s.td,fontFamily:"monospace",fontWeight:700 }}>{item.qty}</td>
                  <td style={s.td}>
                    <input
                      type="number" min={0} max={item.qty}
                      value={r.qty} disabled={!r.check}
                      onChange={e=>setRecibidos(p=>({...p,[item.prodId]:{...p[item.prodId],qty:Math.min(item.qty,Math.max(0,+e.target.value))}}))}
                      style={{ ...s.input,width:80,padding:"5px 8px",fontFamily:"monospace",opacity:r.check?1:0.4,
                        borderColor: r.check ? (completo?C.green:C.yellow) : C.border }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {hayFaltantes && (
          <div style={{ background:`${C.yellow}10`,border:`1px solid ${C.yellow}30`,borderRadius:8,padding:12,margin:"14px 0" }}>
            <div style={{ fontSize:12,color:C.yellow,fontWeight:600,marginBottom:6 }}><AlertTriangle size={12} style={{ display:"inline",marginRight:4 }}/>Artículos faltantes — podés notificar al proveedor</div>
            <pre style={{ fontSize:11,color:C.subtle,whiteSpace:"pre-wrap",margin:0,background:C.surface,padding:10,borderRadius:6 }}>{buildMsgFaltantes()}</pre>
            <div style={{ display:"flex",gap:8,marginTop:10 }}>
              <button style={{ ...s.btn("green"),fontSize:12,padding:"6px 12px" }} onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(buildMsgFaltantes())}`,"_blank")}><MessageCircle size={13}/> WhatsApp</button>
              <button style={{ ...s.btn("blue"),fontSize:12,padding:"6px 12px" }} onClick={()=>window.open(`mailto:?subject=Recepción+parcial+OP+%23${pedido.id}&body=${encodeURIComponent(buildMsgFaltantes())}`)}><Mail size={13}/> Email</button>
            </div>
          </div>
        )}

        <div style={{ display:"flex",justifyContent:"flex-end",gap:10,marginTop:16 }}>
          <button style={s.btn("ghost")} onClick={onClose}>Cancelar</button>
          <button style={s.btn(hayFaltantes?"green":"primary")} onClick={confirmar}>
            {hayFaltantes ? "Confirmar recepción parcial" : "Confirmar recepción completa"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Pedidos({ proveedores, productos, setProductos, pedidos, setPedidos, configAdmin={}, cotizacionUSD=1200 }) {
  const { C, s } = useTheme()
  const [step, setStep]           = useState("lista")
  const [provSel, setProvSel]     = useState(String(proveedores[0]?.id||1))
  const [checked, setChecked]     = useState({})
  const [qtys, setQtys]           = useState({})
  const [nota, setNota]           = useState("")
  const [plazo, setPlazo]         = useState(30)
  const [orderData, setOrderData] = useState(null)
  const [opDetail, setOpDetail]   = useState(null)
  const [recModal, setRecModal]   = useState(null)
  const [listSort, setListSort]   = useState({col:'fecha',dir:'desc'})

  const [sortField, setSortField] = useState('nombre')
  const [sortDir,   setSortDir]   = useState('asc')
  const prov      = proveedores.find(p=>p.id===+provSel)
  const provProds = useMemo(()=>{
    const base = productos.filter(p=>p.provId===+provSel)
    return [...base].sort((a,b)=>{
      const mul = sortDir==='asc'?1:-1
      if (sortField==='stock')    return (a.stock-b.stock)*mul
      if (sortField==='minStock') return (a.minStock-b.minStock)*mul
      if (sortField==='costo')    return (a.costo-b.costo)*mul
      return a.nombre.localeCompare(b.nombre)*mul
    })
  },[productos,provSel,sortField,sortDir])
  const selItems  = provProds.filter(p=>checked[p.id]).map(p=>{
    const costoARS = (p.moneda||'ARS')==='USD' ? Math.round((p.costo||0)*cotizacionUSD) : (p.costo||0)
    return {...p, qtySol:+qtys[p.id]||1, costoARS}
  })
  const totalEst  = selItems.reduce((a,b)=>a+b.costoARS*b.qtySol,0)

  // Reset plazo al valor del proveedor seleccionado
  React.useEffect(()=>{ const p=proveedores.find(x=>x.id===+provSel); if(p?.plazo) setPlazo(p.plazo) },[provSel])
  const toggle = id => { setChecked(p=>({...p,[id]:!p[id]})); if(!qtys[id]) setQtys(p=>({...p,[id]:1})) }
  const preSelBajo = () => { const nc={},nq={}; provProds.filter(p=>p.stock<=p.minStock).forEach(p=>{nc[p.id]=true;nq[p.id]=Math.max(1,p.minStock*2-p.stock)}); setChecked(nc);setQtys(nq) }
  const buildText = () => `📦 *ORDEN DE COMPRA — Ferretería Pro*\nFecha: ${new Date().toLocaleDateString("es-AR")}\n\nProveedor: *${prov?.nombre}*\n\n${selItems.map(i=>`• ${i.nombre} — ${i.qtySol} u.`).join("\n")}\n\n*Total: ${fmt(totalEst)}*${nota?`\n\nNota: ${nota}`:""}`
  const generar = () => { if(!selItems.length)return; setOrderData({text:buildText(),items:selItems,total:totalEst}); setStep("preview") }
  const guardarPedido = () => {
    const fechaHoy = today()
    const fechaPago = (() => { const d=new Date(fechaHoy+'T00:00:00'); d.setDate(d.getDate()+plazo); return d.toISOString().slice(0,10) })()
    setPedidos(prev=>[...prev,{id:nextId(prev),fecha:fechaHoy,proveedorId:+provSel,proveedorNombre:prov?.nombre,items:selItems.map(i=>({prodId:i.id,nombre:i.nombre,sku:i.sku,qty:i.qtySol,costo:i.costoARS,costoOriginal:i.costo,moneda:i.moneda||'ARS'})),total:orderData.total,estado:"enviado",nota,plazo,fechaPago,estadoPago:'pendiente'}])
    setStep("lista");setChecked({});setQtys({});setNota("");setOrderData(null)
  }
  const enviarWA    = ()=>{window.open(`https://wa.me/${prov?.tel?.replace(/\D/g,"")}?text=${encodeURIComponent(orderData.text)}`,"_blank");guardarPedido()}
  const enviarEmail = ()=>{window.open(`mailto:${prov?.email}?subject=Orden+de+Compra&body=${encodeURIComponent(orderData.text.replace(/\*/g,""))}`);guardarPedido()}
  const cambiarEstado = (id,e)=>{setPedidos(prev=>prev.map(p=>p.id===id?{...p,estado:e}:p));if(opDetail?.id===id)setOpDetail(prev=>({...prev,estado:e}))}

  const handleRecepcion = (pedido, itemsActualizados, nuevoEstado) => {
    // Actualizar stock de productos recibidos
    setProductos(prev => prev.map(prod => {
      const item = itemsActualizados.find(i=>i.prodId===prod.id)
      if (!item || !item.qtyRecibida) return prod
      return { ...prod, stock: prod.stock + item.qtyRecibida }
    }))
    setPedidos(prev=>prev.map(p=>p.id===pedido.id?{...p,estado:nuevoEstado,itemsRecibidos:itemsActualizados}:p))
    if(opDetail?.id===pedido.id) setOpDetail(prev=>({...prev,estado:nuevoEstado}))
  }

  if (opDetail) return (
    <div>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:24 }}>
        <button style={s.btn("ghost")} onClick={()=>setOpDetail(null)}><X size={14}/> Volver</button>
        <div>
          <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>OP #{String(opDetail.id).padStart(4,"0")}</h1>
          <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>
            {fmtDate(opDetail.fecha)} · {opDetail.proveedorNombre}
            {opDetail.fechaPago && <> · <span style={{color:C.yellow}}>Vence pago: {fmtDate(opDetail.fechaPago)} ({opDetail.plazo||'?'} días)</span></>}
          </p>
        </div>
        <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>
          <span style={s.badge(ESTADO_COLOR[opDetail.estado]||C.yellow)}>{opDetail.estado}</span>
          {(opDetail.estado==="enviado"||opDetail.estado==="en_tránsito") && (
            <button style={s.btn("green")} onClick={()=>setRecModal(opDetail)}><ClipboardList size={14}/> Registrar recepción</button>
          )}
        </div>
      </div>

      <div style={{ ...s.card,marginBottom:16 }}>
        {opDetail.estado==="recibido" || opDetail.estado==="cancelado" ? (
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0" }}>
            <span style={s.badge(ESTADO_COLOR[opDetail.estado]||C.muted)}>{opDetail.estado}</span>
            <span style={{ fontSize:12,color:C.muted }}>
              {opDetail.estado==="recibido"
                ? "✅ OP recibida y confirmada — el estado ya no puede modificarse."
                : "❌ OP cancelada — el estado ya no puede modificarse."}
            </span>
          </div>
        ) : (
          <>
            <div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:1 }}>Cambiar Estado</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {ESTADOS_PEDIDO.filter(e=>e!=="recibido").map(e=>(
                <button key={e} onClick={()=>cambiarEstado(opDetail.id,e)}
                  style={{ ...s.btn("ghost"),padding:"6px 14px",fontSize:12,
                    background:opDetail.estado===e?ESTADO_COLOR[e]:`${ESTADO_COLOR[e]}18`,
                    color:opDetail.estado===e?"#fff":ESTADO_COLOR[e],
                    border:`1px solid ${ESTADO_COLOR[e]}50` }}>
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
        {opDetail.nota&&<div style={{ marginTop:12,padding:"8px 12px",background:C.surface,borderRadius:8,fontSize:12,color:C.subtle }}>📝 {opDetail.nota}</div>}
      </div>

      <div style={s.card}>
        <div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:1 }}>Productos</div>
        <table style={s.table}>
          <thead><tr>{["Producto","SKU","Pedido","Recibido","Costo","Subtotal"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {opDetail.items.map((it,i)=>{
              const rec = opDetail.itemsRecibidos?.find(r=>r.prodId===it.prodId)
              return <TR key={i}>
                <td style={{ ...s.td,fontWeight:500,color:C.white }}>{it.nombre}</td>
                <td style={{ ...s.td,fontFamily:"monospace",fontSize:11,color:C.muted }}>{it.sku||"—"}</td>
                <td style={{ ...s.td,fontFamily:"monospace",fontWeight:700 }}>{it.qty}</td>
                <td style={s.td}>
                  {rec ? <span style={{ fontFamily:"monospace",fontWeight:700,color:rec.qtyRecibida>=it.qty?C.green:C.yellow }}>{rec.qtyRecibida}/{it.qty}</span> : <span style={{ color:C.muted }}>—</span>}
                </td>
                <td style={{ ...s.td,fontFamily:"monospace" }}>{fmt(it.costo)}</td>
                <td style={{ ...s.td,fontFamily:"monospace",color:C.accent,fontWeight:700 }}>{fmt(it.costo*it.qty)}</td>
              </TR>
            })}
          </tbody>
        </table>
        <div style={{ padding:"14px 14px 0",borderTop:`2px solid ${C.border}`,marginTop:4,display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
          <div style={{ fontSize:11,color:C.muted }}>
            <div>Subtotal s/IVA: <span style={{fontFamily:'monospace'}}>{fmt(Math.round(opDetail.total/1.21))}</span></div>
            <div>IVA 21%: <span style={{fontFamily:'monospace'}}>{fmt(Math.round(opDetail.total-opDetail.total/1.21))}</span></div>
          </div>
          <div style={{ textAlign:"right" }}><div style={{ fontSize:12,color:C.muted }}>Total c/IVA</div><div style={{ fontFamily:"monospace",fontSize:24,fontWeight:800,color:C.accent }}>{fmt(opDetail.total)}</div></div>
        </div>
      </div>

      <div style={{ ...s.card,marginTop:16 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1 }}>Reenviar / Imprimir</div>
          <button style={{ ...s.btn('ghost'),fontSize:12,padding:'5px 12px' }}
            onClick={()=>{
              const prov = proveedores.find(x=>x.id===opDetail.proveedorId)
              const rows = opDetail.items.map(it=>`<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${it.nombre}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${it.sku||'—'}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700">${it.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">$${it.costo.toLocaleString('es-AR')}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#f97316">$${(it.costo*it.qty).toLocaleString('es-AR')}</td></tr>`).join('')
              const sinIva = Math.round(opDetail.total/1.21), ivaAmt = opDetail.total-sinIva
              const win = window.open('','_blank')
              win.document.write(`<!DOCTYPE html><html><head><title>OP #${String(opDetail.id).padStart(4,'0')}</title>
              <style>body{font-family:Arial,sans-serif;max-width:700px;margin:30px auto;font-size:14px}
              .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #f97316}
              .logo-area{display:flex;align-items:center;gap:12px}.logo-area img{width:48px;height:48px;object-fit:contain}
              .brand{font-size:20px;font-weight:800}.brand span{color:#f97316}.by{font-size:11px;color:#888}
              table{width:100%;border-collapse:collapse}thead tr{background:#f97316}thead th{color:#fff;padding:9px 12px;text-align:left}
              .total-box{display:flex;justify-content:flex-end;margin-top:12px;gap:40px}
              @media print{.no-print{display:none}}</style></head><body>
              <div class="header">
                <div class="logo-area">
                  <img src="${configAdmin.logoCustom||'/logo.png'}" onerror="this.style.display='none'"/>
                  <div><div class="brand">${configAdmin.nombreLocal||'Ferretería'} <span>Pro</span></div>
                  <div class="by">${configAdmin.cuit?'CUIT: '+configAdmin.cuit+' · ':''} ${configAdmin.condIva||''}</div>
                  ${configAdmin.domicilio?`<div style="font-size:11px;color:#666">${configAdmin.domicilio}</div>`:''}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:24px;font-weight:800;color:#f97316">ORDEN DE COMPRA</div>
                  <div style="color:#666">#${String(opDetail.id).padStart(4,'0')} · ${new Date(opDetail.fecha+'T00:00:00').toLocaleDateString('es-AR')}</div>
                  ${opDetail.fechaPago?`<div style="font-size:12px;color:#ef4444">Vence: ${new Date(opDetail.fechaPago+'T00:00:00').toLocaleDateString('es-AR')}</div>`:''}
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;font-size:13px">
                <div style="background:#f9f9f9;border-radius:8px;padding:12px"><strong>Proveedor</strong><br/>${prov?.nombre||opDetail.proveedorNombre}<br/><span style="color:#666;font-size:12px">${prov?.contacto||''} ${prov?.tel?'· '+prov.tel:''}</span></div>
                <div style="background:#f9f9f9;border-radius:8px;padding:12px"><strong>Condiciones</strong><br/>Plazo: ${opDetail.plazo||30} días<br/>Pago: ${prov?.formaPagoDefault||'—'}</div>
              </div>
              <table><thead><tr><th>Producto</th><th>SKU</th><th style="text-align:center">Qty</th><th style="text-align:right">Costo unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
              <tbody>${rows}</tbody></table>
              <div class="total-box">
                <div style="text-align:right;font-size:13px;color:#666">
                  <div>Subtotal s/IVA: $${sinIva.toLocaleString('es-AR')}</div>
                  <div>IVA 21%: $${ivaAmt.toLocaleString('es-AR')}</div>
                  <div style="font-size:18px;font-weight:800;color:#f97316;margin-top:6px">TOTAL: $${opDetail.total.toLocaleString('es-AR')}</div>
                </div>
              </div>
              ${opDetail.nota?`<div style="margin-top:16px;padding:10px;background:#f9f9f9;border-radius:8px;font-size:12px">📝 ${opDetail.nota}</div>`:''}
              <div class="no-print" style="margin-top:24px">
                <button onclick="window.print()" style="padding:10px 24px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🖨 Imprimir</button>
              </div></body></html>`)
              win.document.close()
            }}>
            🖨 Imprimir OP
          </button>
        </div>
        {(()=>{const p=proveedores.find(x=>x.id===opDetail.proveedorId);const txt=`📦 OP #${String(opDetail.id).padStart(4,"0")}\n${opDetail.proveedorNombre}\n\n${opDetail.items.map(i=>`• ${i.nombre} — ${i.qty} u.`).join("\n")}\n\nTotal: ${fmt(opDetail.total)}`; return<div style={{ display:"flex",gap:10 }}><button style={s.btn("green")} onClick={()=>window.open(`https://wa.me/${p?.tel?.replace(/\D/g,"")}?text=${encodeURIComponent(txt)}`,"_blank")}><MessageCircle size={14}/> WhatsApp</button><button style={s.btn("blue")} onClick={()=>window.open(`mailto:${p?.email}?subject=OP+%23${opDetail.id}&body=${encodeURIComponent(txt)}`)}><Mail size={14}/> Email</button></div>})()}
      </div>

      {recModal && <RecepcionModal pedido={recModal} onClose={()=>setRecModal(null)} onGuardar={(items,estado)=>handleRecepcion(recModal,items,estado)}/>}
    </div>
  )

  if (step==="preview"&&orderData) return (
    <div>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:24 }}><button style={s.btn("ghost")} onClick={()=>setStep("nuevo")}><X size={14}/> Volver</button><h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>Vista previa</h1></div>
      <div style={s.grid(2)}>
        <div style={s.card}><div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:1 }}>Detalle</div><table style={s.table}><thead><tr>{["Producto","Qty","Costo","Subtotal"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{orderData.items.map(i=><TR key={i.id}><td style={{ ...s.td,color:C.white,fontWeight:500 }}>{i.nombre}</td><td style={{ ...s.td,fontFamily:"monospace",fontWeight:700 }}>{i.qtySol}</td><td style={{ ...s.td,fontFamily:"monospace" }}>{fmt(i.costo)}</td><td style={{ ...s.td,fontFamily:"monospace",color:C.accent,fontWeight:700 }}>{fmt(i.costo*i.qtySol)}</td></TR>)}</tbody></table><div style={{ display:"flex",justifyContent:"space-between",padding:"14px 14px 0",borderTop:`2px solid ${C.border}`,marginTop:4 }}><span style={{ fontWeight:700,color:C.white }}>Total</span><span style={{ fontFamily:"monospace",fontSize:20,fontWeight:800,color:C.accent }}>{fmt(orderData.total)}</span></div></div>
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div style={s.card}><div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1 }}>Mensaje</div><pre style={{ background:C.surface,borderRadius:8,padding:14,fontSize:12,color:C.text,whiteSpace:"pre-wrap",margin:0,maxHeight:200,overflowY:"auto",lineHeight:1.6 }}>{orderData.text}</pre></div>
          <div style={s.card}><div style={{ fontSize:12,fontWeight:700,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:1 }}>Enviar a {prov?.nombre}</div><div style={{ display:"flex",flexDirection:"column",gap:10 }}><button style={{ ...s.btn("green"),padding:"12px 16px",fontSize:14,justifyContent:"center" }} onClick={enviarWA}><MessageCircle size={18}/> WhatsApp</button><button style={{ ...s.btn("blue"),padding:"12px 16px",fontSize:14,justifyContent:"center" }} onClick={enviarEmail}><Mail size={18}/> Email</button><button style={{ ...s.btn("ghost"),padding:"12px 16px",fontSize:14,justifyContent:"center" }} onClick={guardarPedido}>Solo guardar</button></div></div>
        </div>
      </div>
    </div>
  )

  if (step==="nuevo") return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}><button style={s.btn("ghost")} onClick={()=>{setStep("lista");setChecked({});setQtys({})}}><X size={14}/> Cancelar</button><h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>Nuevo Pedido</h1></div>
        <div style={{ display:"flex",gap:8 }}>
          {provProds.some(p=>p.stock<=p.minStock)&&<button style={{ ...s.btn("ghost"),color:C.yellow,border:`1px solid ${C.yellow}40` }} onClick={preSelBajo}><AlertTriangle size={13}/> Preseleccionar stock bajo</button>}
          <button style={s.btn()} onClick={generar} disabled={!selItems.length}><Eye size={14}/> Ver Orden ({selItems.length})</button>
        </div>
      </div>
      <div style={{ display:"flex",gap:12,marginBottom:20 }}>
        <div style={{ flex:"0 0 240px" }}><label style={s.label}>Proveedor</label><select style={s.input} value={provSel} onChange={e=>{setProvSel(e.target.value);setChecked({});setQtys({})}}>{proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div style={{ flex:'0 0 180px' }}>
          <label style={s.label}>Plazo de pago</label>
          <select style={s.input} value={plazo} onChange={e=>setPlazo(+e.target.value)}>
            {[7,15,30,45,60].map(d=><option key={d} value={d}>{d} días</option>)}
          </select>
        </div>
        <div style={{ flex:1 }}><label style={s.label}>Nota</label><input style={s.input} placeholder="Urgente, para el viernes..." value={nota} onChange={e=>setNota(e.target.value)}/></div>
      </div>
      {selItems.length>0&&<div style={{ background:C.accentDim,border:`1px solid rgba(249,115,22,0.3)`,borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",justifyContent:"space-between" }}><span style={{ fontSize:13,color:C.accent,fontWeight:600 }}>{selItems.length} seleccionados</span><span style={{ fontFamily:"monospace",fontSize:16,fontWeight:800,color:C.accent }}>{fmt(totalEst)}</span></div>}
      {provProds.length===0?<div style={{ ...s.card,textAlign:"center",padding:48,color:C.subtle }}>Sin productos para este proveedor</div>:(
        <div style={s.card}><table style={s.table}>
          <thead><tr>
            <th style={{...s.th,width:36}}></th>
            {[
              {k:'nombre',   l:'Producto'},
              {k:'sku',      l:'SKU'},
              {k:'stock',    l:'Stock'},
              {k:'minStock', l:'Mín.'},
              {k:'estado',   l:'Estado'},
              {k:'',         l:'Cant.'},
              {k:'costo',    l:'Costo'},
              {k:'subtotal', l:'Subtotal'},
            ].map(h=>(
              <th key={h.k||h.l} style={{...s.th,cursor:h.k?'pointer':'default',userSelect:'none'}}
                onClick={()=>h.k&&(sortField===h.k ? setSortDir(d=>d==='asc'?'desc':'asc') : (setSortField(h.k),setSortDir('asc')))}>
                <span style={{display:'inline-flex',alignItems:'center',gap:3}}>
                  {h.l}
                  {sortField===h.k&&<span style={{fontSize:10,color:C.accent}}>{sortDir==='asc'?'▲':'▼'}</span>}
                </span>
              </th>
            ))}
          </tr></thead>
          <tbody>{provProds.map(p=>{const on=!!checked[p.id];const q=+qtys[p.id]||1;const bajo=p.stock<=p.minStock;return(
            <tr key={p.id} style={{ background:on?`${C.accent}0b`:bajo?`${C.yellow}08`:"" }} onMouseEnter={e=>{if(!on)e.currentTarget.style.background=C.rowHover}} onMouseLeave={e=>{e.currentTarget.style.background=on?`${C.accent}0b`:bajo?`${C.yellow}08`:""}}>
              <td style={{ ...s.td,textAlign:"center" }}><input type="checkbox" checked={on} onChange={()=>toggle(p.id)} style={{ width:16,height:16,cursor:"pointer",accentColor:C.accent }}/></td>
              <td style={{ ...s.td,fontWeight:on?600:400,color:on?C.white:C.text }}>{p.nombre}</td>
              <td style={{ ...s.td,fontFamily:"monospace",fontSize:11,color:C.muted }}>{p.sku||"—"}</td>
              <td style={{ ...s.td,fontFamily:"monospace",fontWeight:700,color:bajo?C.yellow:C.green }}>{p.stock}</td>
              <td style={{ ...s.td,fontFamily:"monospace",color:C.muted }}>{p.minStock}</td>
              <td style={s.td}><StockBadge stock={p.stock} min={p.minStock}/></td>
              <td style={s.td}><input type="number" min={1} value={on?q:""} placeholder="—" disabled={!on} onChange={e=>setQtys(prev=>({...prev,[p.id]:Math.max(1,+e.target.value||1)}))} style={{ ...s.input,width:72,padding:"5px 8px",fontFamily:"monospace",opacity:on?1:0.4 }}/></td>
              <td style={{ ...s.td,fontFamily:"monospace",fontSize:12,color:C.muted }}>
                {(p.moneda||'ARS')==='USD'
                  ? <span><span style={{fontSize:9,color:'#eab308'}}>USD {p.costo}</span><br/><span style={{fontSize:10}}>≈{fmt(Math.round(p.costo*cotizacionUSD))}</span></span>
                  : fmt(p.costo||0)}
              </td>
              <td style={{ ...s.td,fontFamily:"monospace",color:on?C.accent:C.muted,fontWeight:on?700:400 }}>
                {on ? fmt(((p.moneda||'ARS')==='USD'?Math.round((p.costo||0)*cotizacionUSD):(p.costo||0))*q) : "—"}
              </td>
            </tr>
          )})}</tbody>
        </table></div>
      )}
    </div>
  )

  const stats={}; ESTADOS_PEDIDO.forEach(e=>{stats[e]=pedidos.filter(p=>p.estado===e).length})
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div><h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>Órdenes de Pedido</h1><p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>{pedidos.length} órdenes · {fmt(pedidos.reduce((a,b)=>a+b.total,0))}</p></div>
        <button style={s.btn()} onClick={()=>setStep("nuevo")}><Plus size={15}/> Nuevo Pedido</button>
      </div>
      {pedidos.length>0&&<div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" }}>{ESTADOS_PEDIDO.filter(e=>stats[e]>0).map(e=><div key={e} style={{ padding:"6px 14px",borderRadius:8,background:`${ESTADO_COLOR[e]}18`,border:`1px solid ${ESTADO_COLOR[e]}40`,display:"flex",alignItems:"center",gap:6 }}><span style={{ width:8,height:8,borderRadius:"50%",background:ESTADO_COLOR[e],display:"inline-block" }}/><span style={{ fontSize:12,color:ESTADO_COLOR[e],fontWeight:600 }}>{stats[e]} {e}</span></div>)}</div>}
      {pedidos.length===0?(
        <div style={{ ...s.card,textAlign:"center",padding:64 }}><ClipboardList size={40} color={C.muted} style={{ marginBottom:12 }}/><div style={{ color:C.subtle,fontSize:15,fontWeight:600 }}>No hay pedidos todavía</div><button style={{ ...s.btn(),marginTop:20 }} onClick={()=>setStep("nuevo")}><Plus size={14}/> Crear primer pedido</button></div>
      ):(
        <div style={s.card}><table style={s.table}><thead><tr>
          {[{k:'id',l:'#'},{k:'fecha',l:'Fecha'},{k:'proveedorNombre',l:'Proveedor'},{k:'items',l:'Items'},{k:'total',l:'Total'},{k:'estado',l:'Estado'},{k:'fechaPago',l:'Vence Pago'},{k:'nota',l:'Nota'}].map(h=>(
            <th key={h.k} style={{...s.th,cursor:'pointer',userSelect:'none'}} onClick={()=>setListSort(p=>({col:h.k,dir:p.col===h.k&&p.dir==='asc'?'desc':'asc'}))}>
              <span style={{display:'inline-flex',alignItems:'center',gap:3}}>
                {h.l}
                {listSort.col===h.k && <span style={{fontSize:10,color:C.accent}}>{listSort.dir==='asc'?'▲':'▼'}</span>}
              </span>
            </th>
          ))}
          <th style={s.th}></th></tr></thead>
          <tbody>{[...pedidos].sort((a,b)=>{
            const mul=listSort.dir==='asc'?1:-1
            if(listSort.col==='id') return (a.id-b.id)*mul
            if(listSort.col==='total') return (a.total-b.total)*mul
            if(listSort.col==='items') return (a.items.length-b.items.length)*mul
            const av=a[listSort.col]||''; const bv=b[listSort.col]||''
            return av.localeCompare(bv)*mul
          }).map(p=>(
            <TR key={p.id}>
              <td style={{ ...s.td,fontFamily:"monospace",color:C.muted,fontSize:11 }}>#{String(p.id).padStart(4,"0")}</td>
              <td style={s.td}>{fmtDate(p.fecha)}</td>
              <td style={{ ...s.td,fontWeight:600,color:C.white }}>{p.proveedorNombre}</td>
              <td style={{ ...s.td,color:C.muted }}>{p.items.length} prod.</td>
              <td style={{ ...s.td,fontFamily:"monospace",color:C.accent,fontWeight:700 }}>{fmt(p.total)}</td>
              <td style={s.td}><span style={s.badge(ESTADO_COLOR[p.estado]||C.yellow)}>{p.estado}</span></td>
              <td style={{ ...s.td,fontSize:11 }}>
                {p.fechaPago ? <span style={{color:(() => {
                  const diff=Math.round((new Date(p.fechaPago+'T00:00:00')-new Date(today()+'T00:00:00'))/(1000*60*60*24))
                  return diff<0?C.red:diff<=7?C.yellow:C.muted
                })(), fontFamily:'monospace'}}>{p.fechaPago}</span> : <span style={{color:C.muted}}>—</span>}
              </td>
              <td style={{ ...s.td,fontSize:12,color:C.muted }}>{p.nota||"—"}</td>
              <td style={s.td}><button onClick={()=>setOpDetail(p)} style={{ ...s.btn("ghost"),padding:"4px 10px",fontSize:11 }}><Eye size={12}/> Ver OP</button></td>
            </TR>
          ))}</tbody>
        </table></div>
      )}
    </div>
  )
}
