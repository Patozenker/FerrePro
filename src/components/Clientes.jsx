import React, { useState, useMemo } from 'react'
import { Search, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Eye, MessageCircle } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import NotaCredito from './NotaCredito'
import { fmt, fmtDate, today, nextId } from '../utils'
import { Modal, FF, TR } from './Shared'

function printDoc(venta, cliente, productos, modo, configAdmin={}) {
  const tipoStr = venta.tipo==='presupuesto' ? 'PRESUPUESTO' : venta.tipo==='remito' ? 'REMITO' : 'FACTURA'
  const esRemito = modo === 'remito'
  const rows = venta.items.map(it => {
    const p = productos?.find(x=>x.id===it.prodId)
    const sub = it.precio*it.qty*(1-(it.descuento||0)/100)
    return `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #eee">${p?.nombre||'Prod #'+it.prodId}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
      ${esRemito ? '<td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:center">__________</td>'
        : `<td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right">$ ${it.precio.toLocaleString('es-AR')}</td>
           <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700">$ ${sub.toLocaleString('es-AR')}</td>`}
    </tr>`
  }).join('')
  const sinIva = Math.round(venta.total / 1.21)
  const iva    = venta.total - sinIva
  const win = window.open('','_blank')
  win.document.write(`<!DOCTYPE html><html><head><title>${tipoStr} #${String(venta.id).padStart(4,'0')}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:700px;margin:30px auto;color:#222;font-size:14px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #f97316}
    .logo-area{display:flex;align-items:center;gap:12px}
    .logo-area img{width:52px;height:52px;object-fit:contain}
    .brand{font-size:22px;font-weight:800;color:#111}
    .brand span{color:#f97316}
    .by{font-size:11px;color:#888;letter-spacing:1px}
    .doc-type{font-size:28px;font-weight:800;color:#f97316;text-align:right}
    .doc-num{font-size:14px;color:#666;text-align:right}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;font-size:13px}
    .info-box{background:#f9f9f9;border-radius:8px;padding:12px 14px}
    .info-box label{display:block;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    thead tr{background:#f97316}
    thead th{color:#fff;padding:10px 12px;text-align:left;font-size:13px}
    tfoot td{padding:8px 12px;font-weight:700}
    .total-row{background:#fff7ed;font-size:16px}
    .signs{display:flex;justify-content:space-around;margin-top:48px}
    .sign-box{text-align:center;min-width:160px}
    .sign-box hr{border:none;border-top:1px solid #999;margin-bottom:6px}
    .sign-box p{font-size:12px;color:#666;margin:0}
    @media print{.no-print{display:none}}
  </style></head><body>
  <div class="header">
    <div class="logo-area">
      <img src="${configAdmin.logoCustom||'/logo.png'}" onerror="this.style.display='none'"/>
      <div>
        <div class="brand">${configAdmin.nombreLocal||'Ferretería'}</div>
        <div class="by">
          ${configAdmin.cuit?'CUIT: '+configAdmin.cuit+' · ':''}${configAdmin.condIva||''}
        </div>
        ${configAdmin.domicilio?`<div style="font-size:11px;color:#666">${configAdmin.domicilio}</div>`:''}
        ${configAdmin.telLocal?`<div style="font-size:11px;color:#666">Tel: ${configAdmin.telLocal}</div>`:''}
      </div>
    </div>
    <div>
      <div class="doc-type">${tipoStr}</div>
      <div class="doc-num">#${String(venta.id).padStart(4,'0')} · ${new Date(venta.fecha+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <label>Cliente</label>
      <strong>${cliente?.nombre||'—'}</strong>
      ${cliente?.cuit?`<br/><span style="color:#555;font-size:12px">CUIT: ${cliente.cuit}</span>`:''}
      ${cliente?.condIva?`<br/><span style="color:#888;font-size:11px">${cliente.condIva}</span>`:''}
      ${cliente?.dir?`<br/><span style="color:#666;font-size:12px">${cliente.dir}</span>`:''}
      ${cliente?.tel?`<br/><span style="color:#666;font-size:12px">Tel: ${cliente.tel}</span>`:''}
    </div>
    <div class="info-box">
      <label>Datos del documento</label>
      Fecha: ${new Date(venta.fecha+'T00:00:00').toLocaleDateString('es-AR')}<br/>
      ${!esRemito && venta.formaPago ? `Pago: ${venta.formaPago}<br/>` : ''}
      Estado: ${venta.estado||'—'}
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Producto</th><th style="text-align:center">Cant.</th>
      ${esRemito ? '<th style="text-align:center">Recibido ✓</th>' : '<th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th>'}
    </tr></thead>
    <tbody>${rows}</tbody>
    ${!esRemito ? `<tfoot>
      <tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#666">Subtotal s/IVA:</td><td style="padding:6px 12px;text-align:right">$ ${sinIva.toLocaleString('es-AR')}</td></tr>
      <tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#666">IVA 21%:</td><td style="padding:6px 12px;text-align:right">$ ${iva.toLocaleString('es-AR')}</td></tr>
      <tr class="total-row"><td colspan="3" style="padding:10px 12px;text-align:right;font-size:16px">TOTAL:</td><td style="padding:10px 12px;text-align:right;font-size:18px;color:#f97316">$ ${venta.total.toLocaleString('es-AR')}</td></tr>
    </tfoot>` : ''}
  </table>
  ${esRemito ? `<div class="signs">
    <div class="sign-box"><hr/><p>Firma transportista</p></div>
    <div class="sign-box"><hr/><p>Conformidad receptor</p></div>
  </div>` : ''}
  ${venta.nota ? `<div style="margin-top:16px;padding:10px 14px;background:#f9f9f9;border-radius:8px;font-size:13px;color:#666">📝 ${venta.nota}</div>` : ''}
  <div class="no-print" style="margin-top:24px;display:flex;gap:10px">
    <button onclick="window.print()" style="padding:10px 24px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🖨 Imprimir</button>
    <button onclick="window.close()" style="padding:10px 20px;background:#e5e7eb;color:#333;border:none;border-radius:8px;cursor:pointer;font-size:14px">✕ Cerrar</button>
  </div>
  </body></html>`)
  win.document.close()
}

function FacturaMini({ venta, productos, cliente, onClose, configAdmin={} }) {
  const { C, s } = useTheme()
  const tipoStr = venta.tipo==='presupuesto' ? 'Presupuesto' : venta.tipo==='remito' ? 'Remito' : 'Factura'
  const msgWA = () => {
    const lines = venta.items.map(it=>{
      const p=productos?.find(x=>x.id===it.prodId)
      const sub=it.precio*it.qty*(1-(it.descuento||0)/100)
      return `• ${p?.nombre||'Prod'} x${it.qty} = $${sub.toLocaleString('es-AR')}`
    })
    const nl = '%0A'
    return `${encodeURIComponent(tipoStr+' #'+String(venta.id).padStart(4,'0')+' — '+new Date(venta.fecha+'T00:00:00').toLocaleDateString('es-AR'))}${nl}${encodeURIComponent('Cliente: '+(cliente?.nombre||'—'))}${nl}${nl}${lines.map(l=>encodeURIComponent(l)).join(nl)}${nl}${nl}${encodeURIComponent('Total: $'+venta.total.toLocaleString('es-AR'))}${nl}${nl}${encodeURIComponent('Gracias por su compra! 🔧')}`
  }
  const sinIva = Math.round(venta.total / 1.21)
  const ivaAmt = venta.total - sinIva
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300 }} onClick={onClose}>
      <div style={{ background:"#fff",color:"#222",borderRadius:14,width:560,maxWidth:"95vw",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }} onClick={e=>e.stopPropagation()}>

        {/* Header del documento — estilo factura real */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px 16px",borderBottom:"2px solid #f97316" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <img src={configAdmin?.logoCustom||"/logo.png"} alt="" style={{ width:48,height:48,objectFit:"contain",borderRadius:6 }} onError={e=>e.target.style.display='none'}/>
            <div>
              <div style={{ fontSize:18,fontWeight:800,color:"#111" }}>{configAdmin?.nombreLocal||"Ferretería"}</div>
              {configAdmin?.cuit && <div style={{ fontSize:11,color:"#666" }}>CUIT: {configAdmin.cuit} · {configAdmin.condIva||""}</div>}
              {configAdmin?.domicilio && <div style={{ fontSize:11,color:"#666" }}>{configAdmin.domicilio}</div>}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:26,fontWeight:900,color:"#f97316" }}>{tipoStr.toUpperCase()}</div>
            <div style={{ fontSize:13,color:"#666" }}>#{String(venta.id).padStart(4,"0")} · {fmtDate(venta.fecha)}</div>
            <button onClick={onClose} style={{ marginTop:6,background:"none",border:"1px solid #ddd",borderRadius:6,padding:"3px 10px",cursor:"pointer",color:"#999",fontSize:12 }}>✕ Cerrar</button>
          </div>
        </div>

        {/* Info cliente + doc */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"14px 24px",background:"#f9f9f9" }}>
          <div style={{ background:"#fff",borderRadius:8,padding:"10px 14px",border:"1px solid #eee" }}>
            <div style={{ fontSize:9,color:"#999",textTransform:"uppercase",letterSpacing:.5,marginBottom:3 }}>Cliente</div>
            <div style={{ fontWeight:700,fontSize:14 }}>{cliente?.nombre||"—"}</div>
            {cliente?.cuit && <div style={{ fontSize:11,color:"#666",marginTop:1 }}>CUIT: {cliente.cuit}</div>}
            {cliente?.condIva && <div style={{ fontSize:11,color:"#888" }}>{cliente.condIva}</div>}
            {cliente?.dir && <div style={{ fontSize:11,color:"#666",marginTop:1 }}>{cliente.dir}</div>}
            {cliente?.tel && <div style={{ fontSize:11,color:"#666" }}>Tel: {cliente.tel}</div>}
          </div>
          <div style={{ background:"#fff",borderRadius:8,padding:"10px 14px",border:"1px solid #eee",fontSize:12,color:"#444",lineHeight:1.7 }}>
            <div>Fecha: {fmtDate(venta.fecha)}</div>
            {venta.formaPago && <div>Pago: {venta.formaPago}</div>}
            <div>Estado: {venta.estado||"—"}</div>
          </div>
        </div>

        {/* Tabla de productos */}
        <div style={{ padding:"0 24px" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",marginBottom:0 }}>
            <thead>
              <tr style={{ background:"#f97316" }}>
                {["Producto","Cant.","Precio","Subtotal"].map(h=>(
                  <th key={h} style={{ color:"#fff",padding:"9px 12px",textAlign:h==="Producto"?"left":"right",fontSize:12,fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venta.items.map((it,i)=>{
                const p=productos.find(x=>x.id===it.prodId)
                const sub=it.precio*it.qty*(1-(it.descuento||0)/100)
                return <tr key={i} style={{ borderBottom:"1px solid #eee" }}>
                  <td style={{ padding:"9px 12px",fontSize:13 }}>{p?.nombre||`#${it.prodId}`}</td>
                  <td style={{ padding:"9px 12px",textAlign:"right",fontWeight:700 }}>{it.qty}</td>
                  <td style={{ padding:"9px 12px",textAlign:"right",fontFamily:"monospace" }}>{fmt(it.precio)}</td>
                  <td style={{ padding:"9px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:700 }}>{fmt(sub)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div style={{ padding:"12px 24px 0",borderTop:"1px solid #eee",margin:"0 0 4px" }}>
          <div style={{ display:"flex",justifyContent:"flex-end" }}>
            <div style={{ minWidth:240 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"#666",padding:"3px 0" }}>
                <span>Subtotal s/IVA:</span><span style={{ fontFamily:"monospace" }}>{fmt(sinIva)}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"#666",padding:"3px 0" }}>
                <span>IVA 21%:</span><span style={{ fontFamily:"monospace" }}>{fmt(ivaAmt)}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,padding:"8px 0 4px",borderTop:"2px solid #f97316",marginTop:4 }}>
                <span>TOTAL:</span><span style={{ color:"#f97316",fontFamily:"monospace" }}>{fmt(venta.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {venta.nota && <div style={{ margin:"0 24px 8px",padding:"8px 12px",background:"#fffbf5",borderRadius:8,fontSize:12,color:"#666",border:"1px solid #ffe4c4" }}>📝 {venta.nota}</div>}

        {/* Acciones */}
        <div style={{ display:"flex",gap:8,padding:"14px 24px 20px",flexWrap:"wrap",borderTop:"1px solid #eee",marginTop:8 }}>
          <button onClick={()=>printDoc(venta,cliente,productos,'factura',configAdmin)}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#f97316",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13 }}>
            🖨 Imprimir
          </button>
          <button onClick={()=>printDoc(venta,cliente,productos,'remito',configAdmin)}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#fff",border:"1px solid #ddd",borderRadius:8,color:"#555",fontWeight:600,cursor:"pointer",fontSize:13 }}>
            📋 Remito
          </button>
          {cliente?.tel && (
            <a href={`https://wa.me/${(cliente.tel||'').replace(/\D/g,'')}?text=${msgWA()}`}
              target="_blank" rel="noreferrer"
              style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#25d366",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,textDecoration:"none" }}>
              📲 Enviar WA
            </a>
          )}
          {cliente?.email && (
            <a href={`mailto:${cliente.email}?subject=${tipoStr} %23${String(venta.id).padStart(4,'0')}&body=${msgWA().replace(/%0A/g,'%0D%0A')}`}
              style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#3b82f6",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,textDecoration:"none" }}>
              📧 Email
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ClienteDetalle({ cliente, ventas, setVentas, productos, setProductos, onClose, onUpdate, configAdmin={} }) {
  const { C, s } = useTheme()
  const [tab, setTab]       = useState("cuenta")
  const [pagoMonto, setPM]  = useState("")
  const [pagoNota, setPN]   = useState("")
  const [pagos, setPagos]   = useState(cliente.pagos||[])
  const [docA, setDocA]     = useState(null)
  const [ncVenta, setNcVenta] = useState(null)  // venta para emitir nota crédito

  const facturas     = ventas.filter(v=>v.clienteId===cliente.id&&v.tipo!=="presupuesto")
  const presupuestos = ventas.filter(v=>v.clienteId===cliente.id&&v.tipo==="presupuesto")
  const totalFact    = facturas.reduce((a,b)=>a+b.total,0)
  // Solo generan deuda las facturas en Cuenta Corriente
  const facturasCuenta = facturas.filter(v=>v.formaPago==="Cuenta Cte.")
  const totalDeuda   = facturasCuenta.reduce((a,b)=>a+b.total,0)
  const totalPag     = pagos.reduce((a,b)=>a+b.monto,0)
  const saldo        = Math.max(0, totalDeuda - totalPag)

  // Deudas por antigüedad
  const hoy = new Date()
  const deudaSemana = facturasCuenta.filter(v=>{
    const d=new Date(v.fecha); const diff=(hoy-d)/(1000*60*60*24)
    return diff>7 && diff<=30
  }).reduce((a,b)=>a+b.total,0)
  const deudaMes = facturasCuenta.filter(v=>{
    const d=new Date(v.fecha); const diff=(hoy-d)/(1000*60*60*24)
    return diff>30
  }).reduce((a,b)=>a+b.total,0)

  const registrarPago = () => {
    if (!pagoMonto) return
    const np=[...pagos,{id:nextId(pagos),fecha:today(),monto:+pagoMonto,nota:pagoNota}]
    setPagos(np); onUpdate({...cliente,pagos:np}); setPM(""); setPN("")
  }

  const buildMsgWA = () => {
    const facts=facturas.filter(v=>v.formaPago==="Cuenta Cte.")
    const lines=facts.map(v=>`• Fac #${String(v.id).padStart(4,"0")} — ${fmtDate(v.fecha)} — ${fmt(v.total)}`).join("\n")
    return encodeURIComponent(`Hola ${cliente.nombre},\n\nLe informamos que tiene un saldo pendiente en cuenta corriente de *${fmt(saldo)}*\n\nDetalle facturas en cta. cte.:\n${lines}\n\nPagado a cuenta: ${fmt(totalPag)}\n*Saldo pendiente: ${fmt(saldo)}*\n\nQuedamos a su disposición para coordinar el pago. Muchas gracias!`)
  }

  const tabs=[{id:"cuenta",label:"Cuenta Cte."},{id:"facturas",label:`Facturas (${facturas.length})`},{id:"presupuestos",label:`Presupuestos (${presupuestos.length})`},{id:"remitos",label:"Remitos"},{id:"pagos",label:`Pagos (${pagos.length})`}]

  return (
    <Modal title={cliente.nombre} onClose={onClose} width={720}>
      {/* 6 KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr",gap:8,marginBottom:14 }}>
        {[
          {label:"Facturado",        value:fmt(totalFact),   color:C.accent},
          {label:"Pagado",           value:fmt(totalPag),    color:C.green },
          {label:"Saldo Cta. Cte.",  value:fmt(saldo),       color:saldo>0?C.red:C.green},
          {label:"Deuda 7-30 días",  value:fmt(deudaSemana), color:deudaSemana>0?C.yellow:C.muted},
          {label:"Deuda +30 días",   value:fmt(deudaMes),    color:deudaMes>0?C.red:C.muted},
          {label:"Facturas",         value:facturas.length,  color:C.blue  },
        ].map(k=>(
          <div key={k.label} style={{ padding:"8px 10px",background:C.surface,borderRadius:8,borderLeft:`2px solid ${k.color}` }}>
            <div style={{ fontSize:9,color:C.muted,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5 }}>{k.label}</div>
            <div style={{ fontSize:14,fontWeight:800,color:k.color,fontFamily:"monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Alertas de deuda + botón WhatsApp */}
      {saldo>0&&(
        <div style={{ background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <AlertTriangle size={13} color={C.red}/>
            <span style={{ fontSize:12,color:C.red,fontWeight:600 }}>Deuda total: {fmt(saldo)}</span>
            {deudaMes>0&&<span style={s.badge(C.red)}>+30d: {fmt(deudaMes)}</span>}
            {deudaSemana>0&&<span style={s.badge(C.yellow)}>7-30d: {fmt(deudaSemana)}</span>}
          </div>
          <a href={`https://wa.me/${(cliente.tel||"").replace(/\D/g,"")}?text=${buildMsgWA()}`} target="_blank" rel="noreferrer"
            style={{ ...s.btn("green"),textDecoration:"none",padding:"5px 12px",fontSize:12 }}>
            <MessageCircle size={13}/> Reclamar por WA
          </a>
        </div>
      )}

      {/* Registrar pago */}
      <div style={{ ...s.card,padding:12,marginBottom:12 }}>
        <div style={{ fontSize:11,fontWeight:700,color:C.subtle,marginBottom:8,textTransform:"uppercase",letterSpacing:1 }}>Registrar Pago</div>
        <div style={{ display:"flex",gap:8 }}>
          <div style={{ flex:"0 0 120px" }}><label style={s.label}>Monto</label><input style={s.input} type="number" placeholder="0" value={pagoMonto} onChange={e=>setPM(e.target.value)}/></div>
          <div style={{ flex:1 }}><label style={s.label}>Nota</label><input style={s.input} placeholder="Se paga factura #0012, seña..." value={pagoNota} onChange={e=>setPN(e.target.value)}/></div>
          <div style={{ display:"flex",alignItems:"flex-end" }}><button style={s.btn()} onClick={registrarPago}><Plus size={13}/> Registrar</button></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:4,marginBottom:12,flexWrap:"wrap" }}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={s.tab(tab===t.id)}>{t.label}</button>)}
      </div>

      {tab==="cuenta"&&(
        <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:320,overflowY:"auto" }}>
          {[
            ...facturas.map(v=>({tipo:"factura",fecha:v.fecha,monto:v.total,id:`f${v.id}`,label:`Factura #${String(v.id).padStart(4,"0")}`,items:v.items.length,doc:v,forma:v.formaPago})),
            ...pagos.map(p=>({tipo:"pago",fecha:p.fecha,monto:p.monto,id:`p${p.id}`,label:p.nota||"Pago recibido"})),
          ].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(ev=>(
            <div key={ev.id} onClick={()=>ev.doc&&setDocA(ev.doc)}
              style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,cursor:ev.doc?"pointer":"default" }}
              onMouseEnter={e=>{if(ev.doc)e.currentTarget.style.background=C.card}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.surface}}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:ev.tipo==="pago"?C.green:C.accent,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:500 }}>{ev.label}</div>
                <div style={{ fontSize:11,color:C.muted }}>{fmtDate(ev.fecha)}{ev.items?` · ${ev.items} prod`:""}{ev.forma?` · ${ev.forma}`:""}</div>
              </div>
              <div style={{ fontFamily:"monospace",fontWeight:700,color:ev.tipo==="pago"?C.green:C.accent,fontSize:14 }}>{ev.tipo==="pago"?"+":"-"}{fmt(ev.monto)}</div>
              {ev.doc&&<Eye size={13} color={C.muted}/>}
            </div>
          ))}
        </div>
      )}

      {tab==="facturas"&&(facturas.length===0?<div style={{ textAlign:"center",color:C.muted,padding:28 }}>Sin facturas</div>:(
        <table style={s.table}><thead><tr>{["#","Fecha","Items","Total","Pago","Estado",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>{[...facturas].reverse().map(v=>(
            <TR key={v.id} onClick={()=>setDocA(v)}>
              <td style={{ ...s.td,fontFamily:"monospace",color:C.muted,fontSize:11 }}>#{String(v.id).padStart(4,"0")}</td>
              <td style={s.td}>{fmtDate(v.fecha)}</td><td style={{ ...s.td,color:C.muted }}>{v.items.length}</td>
              <td style={{ ...s.td,fontFamily:"monospace",color:C.accent,fontWeight:700 }}>{fmt(v.total)}</td>
              <td style={{ ...s.td,fontSize:12,color:C.muted }}>{v.formaPago||"—"}</td>
              <td style={s.td}><span style={s.badge(v.estado==="completada"?C.green:C.yellow)}>{v.estado}</span></td>
              <td style={s.td}><Eye size={13} color={C.muted}/></td>
            </TR>
          ))}</tbody>
        </table>
      ))}

      {tab==="presupuestos"&&(presupuestos.length===0?<div style={{ textAlign:"center",color:C.muted,padding:28 }}>Sin presupuestos</div>:(
        <table style={s.table}><thead><tr>{["#","Fecha","Items","Total",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>{[...presupuestos].reverse().map(v=>(
            <TR key={v.id} onClick={()=>setDocA(v)}><td style={{ ...s.td,fontFamily:"monospace",color:C.muted,fontSize:11 }}>#{String(v.id).padStart(4,"0")}</td><td style={s.td}>{fmtDate(v.fecha)}</td><td style={{ ...s.td,color:C.muted }}>{v.items.length}</td><td style={{ ...s.td,fontFamily:"monospace",color:C.blue,fontWeight:700 }}>{fmt(v.total)}</td><td style={s.td}><Eye size={13} color={C.muted}/></td></TR>
          ))}</tbody>
        </table>
      ))}

      {tab==="remitos"&&(
        facturas.length===0?<div style={{ textAlign:"center",color:C.muted,padding:28 }}>Sin facturas para generar remito</div>:(
          <div>
            <div style={{ fontSize:12,color:C.muted,marginBottom:12 }}>
              Seleccioná una factura para imprimir como remito (sin montos)
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {[...facturas].reverse().slice(0,10).map(v=>(
                <div key={v.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600,color:C.white }}>Factura #{String(v.id).padStart(4,"0")} — {fmtDate(v.fecha)}</div>
                    <div style={{ fontSize:11,color:C.muted }}>{v.items.length} productos</div>
                  </div>
                  <button onClick={()=>{
                    const win=window.open("","_blank")
                    const prod_lines=v.items.map(it=>{
                      const p=productos?.find(x=>x.id===it.prodId)
                      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${p?.nombre||"Prod #"+it.prodId}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #eee"></td></tr>`
                    }).join("")
                    win.document.write(`<!DOCTYPE html><html><head><title>Remito</title><style>body{font-family:sans-serif;max-width:700px;margin:40px auto}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:10px 12px;text-align:left;border-bottom:2px solid #ddd}@media print{button{display:none}}</style></head><body>
                    <h2 style="margin:0">REMITO</h2>
                    <p style="color:#666">Nº ${String(v.id).padStart(4,"0")} · ${fmtDate(v.fecha)}</p>
                    <p><strong>Cliente:</strong> ${cliente.nombre}</p>
                    <p><strong>Dirección:</strong> ${cliente.dir||"—"}</p>
                    <br/><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Recibido ✓</th></tr></thead><tbody>${prod_lines}</tbody></table>
                    <br/><br/><div style="display:flex;justify-content:space-between;margin-top:40px"><div style="text-align:center"><hr style="width:180px"/><p>Firma transportista</p></div><div style="text-align:center"><hr style="width:180px"/><p>Firma receptor</p></div></div>
                    <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 20px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨 Imprimir</button>
                    </body></html>`)
                    win.document.close()
                  }} style={{ ...s.btn("ghost"),fontSize:12,padding:"6px 12px" }}>🖨 Remito</button>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {tab==="pagos"&&(pagos.length===0?<div style={{ textAlign:"center",color:C.muted,padding:28 }}>Sin pagos</div>:(
        <table style={s.table}><thead><tr>{["Fecha","Monto","Nota"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>{[...pagos].reverse().map(p=><TR key={p.id}><td style={s.td}>{fmtDate(p.fecha)}</td><td style={{ ...s.td,fontFamily:"monospace",color:C.green,fontWeight:700 }}>{fmt(p.monto)}</td><td style={{ ...s.td,color:C.muted,fontSize:12 }}>{p.nota||"—"}</td></TR>)}</tbody>
        </table>
      ))}

      {docA&&<FacturaMini venta={docA} productos={productos} cliente={cliente} onClose={()=>setDocA(null)} configAdmin={configAdmin||{}}/>}
      {ncVenta && (
        <NotaCredito
          venta={ncVenta}
          cliente={cliente}
          productos={productos}
          onClose={()=>setNcVenta(null)}
          onConfirm={({itemsDevueltos, totalNC, motivo, resolucion}) => {
            // 1. Crear registro de nota de crédito en ventas
            if (setVentas) {
              setVentas(prev => [...prev, {
                id: nextId(prev),
                fecha: today(),
                clienteId: cliente.id,
                tipo: 'nota_credito',
                estado: 'nota_credito',
                ventaOrigen: ncVenta.id,
                items: itemsDevueltos,
                total: -totalNC,
                motivo,
                resolucion,
                formaPago: ncVenta.formaPago,
              }])
              // Marcar factura original con nota de crédito
              setVentas(prev => prev.map(v => v.id===ncVenta.id
                ? {...v, estado:'nota_credito', notaCreditoId: nextId(prev)}
                : v))
            }
            // 2. Devolver stock
            if (setProductos) {
              setProductos(prev => prev.map(prod => {
                const item = itemsDevueltos.find(i => i.prodId === prod.id)
                return item ? {...prod, stock: prod.stock + item.qty} : prod
              }))
            }
            // 3. Si se acredita en cuenta, agregar pago negativo (saldo a favor)
            if (resolucion === 'saldo') {
              const np = [...pagos, {id: nextId(pagos), fecha: today(), monto: totalNC, nota: `NC - ${motivo}`}]
              setPagos(np)
              onUpdate({...cliente, pagos: np})
            }
            setNcVenta(null)
            alert(`✅ Nota de crédito emitida por ${totalNC.toLocaleString('es-AR', {style:'currency',currency:'ARS'})}. ${resolucion==='saldo'?'Saldo acreditado en cuenta del cliente.':'Registrar devolución de dinero manualmente.'}`)
          }}
        />
      )}
    </Modal>
  )
}

export default function Clientes({ clientes, setClientes, ventas, setVentas, productos, setProductos, configAdmin={} }) {
  const { C, s } = useTheme()
  const [search, setSearch]   = useState("")
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [detalle, setDetalle] = useState(null)

  const filtered = useMemo(()=>clientes.filter(c=>c.nombre.toLowerCase().includes(search.toLowerCase())),[clientes,search])

  const save = () => {
    if (!form.nombre) return
    if (modal.mode==="add") setClientes(p=>[...p,{...form,id:nextId(p),pagos:[],compras:0}])
    else setClientes(p=>p.map(x=>x.id===modal.item.id?{...x,...form}:x))
    setModal(null)
  }

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:16 }}>
        <div><h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>Clientes</h1><p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>{clientes.length} clientes</p></div>
        <button style={s.btn()} onClick={()=>{setForm({nombre:'',email:'',tel:'',dir:'',cuit:'',condIva:'Consumidor Final',pagos:[],compras:0});setModal({mode:"add"})}}><Plus size={15}/> Nuevo</button>
      </div>
      <div style={{ position:"relative",maxWidth:300,marginBottom:12 }}>
        <Search size={13} style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted }}/>
        <input style={{ ...s.input,paddingLeft:28 }} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{["Cliente","CUIT","Cond. IVA","Email","Teléfono","Facturado","Saldo",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(c=>{
            const vC=ventas.filter(v=>v.clienteId===c.id&&v.tipo!=="presupuesto")
            const fact=vC.reduce((a,b)=>a+b.total,0)
            const pag=(c.pagos||[]).reduce((a,b)=>a+b.monto,0)
            // Solo Cuenta Corriente genera deuda
            const deudaCta=vC.filter(v=>v.formaPago==="Cuenta Cte.").reduce((a,b)=>a+b.total,0)
            const saldo=Math.max(0,deudaCta-pag)
            return <TR key={c.id} onClick={()=>setDetalle(c)}>
              <td style={{ ...s.td,fontWeight:600,color:C.white }}>{c.nombre}{c.compras>0&&<span style={{ fontSize:10,color:C.muted,marginLeft:6 }}>{c.compras}x</span>}</td>
              <td style={{ ...s.td,fontSize:11,color:C.muted }}>{c.cuit||"—"}</td>
              <td style={{ ...s.td,fontSize:11,color:C.muted }}>{c.condIva||"C. Final"}</td>
              <td style={{ ...s.td,color:C.muted,fontSize:12 }}>{c.email}</td>
              <td style={{ ...s.td,fontFamily:"monospace",fontSize:12 }}>{c.tel}</td>
              <td style={{ ...s.td,fontFamily:"monospace",color:C.accent,fontWeight:700 }}>{fmt(fact)}</td>
              <td style={s.td}>{saldo>0?<span style={s.badge(C.red)}>Debe {fmt(saldo)}</span>:<span style={s.badge(C.green)}>Al día</span>}</td>
              <td style={s.td} onClick={e=>e.stopPropagation()}>
                <div style={{ display:"flex",gap:4 }}>
                  <button onClick={()=>{setForm({...c});setModal({mode:"edit",item:c})}} style={{ background:"none",border:"none",color:C.subtle,cursor:"pointer",padding:4 }}><Pencil size={13}/></button>
                  <button onClick={()=>{if(confirm("¿Eliminar?"))setClientes(p=>p.filter(x=>x.id!==c.id))}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",padding:4,opacity:0.6 }}><Trash2 size={13}/></button>
                </div>
              </td>
            </TR>
          })}</tbody>
        </table>
      </div>
      {modal&&<Modal title={modal.mode==="add"?"Nuevo Cliente":"Editar"} onClose={()=>setModal(null)}>
        <div style={s.grid(2)}>
          <FF label="Nombre / Razón Social"><input style={s.input} value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></FF>
          <FF label="CUIT / DNI"><input style={s.input} value={form.cuit||""} placeholder="20-12345678-9" onChange={e=>setForm(f=>({...f,cuit:e.target.value}))}/></FF>
        </div>
        <div style={s.grid(2)}>
          <FF label="Condición IVA">
            <select style={s.input} value={form.condIva||'Consumidor Final'} onChange={e=>setForm(f=>({...f,condIva:e.target.value}))}>
              {['Consumidor Final','Resp. Inscripto','Monotributista','Exento'].map(o=><option key={o}>{o}</option>)}
            </select>
          </FF>
          <FF label="Email"><input style={s.input} type="email" value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></FF>
        </div>
        <div style={s.grid(2)}>
          <FF label="Teléfono"><input style={s.input} value={form.tel||""} onChange={e=>setForm(f=>({...f,tel:e.target.value}))}/></FF>
          <FF label="Dirección"><input style={s.input} value={form.dir||""} onChange={e=>setForm(f=>({...f,dir:e.target.value}))}/></FF>
        </div>
        <FF label="% Ganancia sobre lista de precios">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input style={{ ...s.input, width:100 }} type="number" min={0} max={200} step={1}
              placeholder="0" value={form.pctGanancia||""} onChange={e=>setForm(f=>({...f,pctGanancia:Math.max(0,+e.target.value||0)}))}/>
            <span style={{ fontSize:13, color:C.muted }}>% — 0 = usar precio de lista sin modificar</span>
          </div>
        </FF>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:8 }}>
          <button style={s.btn("ghost")} onClick={()=>setModal(null)}>Cancelar</button>
          <button style={s.btn()} onClick={save}><CheckCircle2 size={14}/> Guardar</button>
        </div>
      </Modal>}
      {detalle&&<ClienteDetalle cliente={detalle} ventas={ventas} setVentas={setVentas} productos={productos} setProductos={setProductos} onClose={()=>setDetalle(null)} onUpdate={u=>setClientes(p=>p.map(c=>c.id===u.id?u:c))} configAdmin={configAdmin}/>}
    </div>
  )
}
