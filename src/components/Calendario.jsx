import React, { useState, useMemo } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt, fmtDate, nextId, today } from '../utils'
import { Modal, FF } from './Shared'

const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const IVA    = 1.21

function dateStr(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
function parseLocal(str) { if (!str) return null; const [y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d) }

export default function Calendario({ pedidos, ventas, proveedores, pagosServicios, setPagosServicios }) {
  const { C, s } = useTheme()
  const now  = new Date()
  const [año,  setAño]  = useState(now.getFullYear())
  const [mes,  setMes]  = useState(now.getMonth())
  const [diaSelec, setDiaSelec] = useState(null)
  const [modal, setModal] = useState(null)   // 'addServicio'
  const [opDetalle, setOpDetalle] = useState(null)  // pedido object to show
  const [form, setForm]   = useState({ nombre:'', monto:'', fechaProx:today(), frecuencia:'mensual', nota:'' })

  const prevMes = () => { if(mes===0){setMes(11);setAño(a=>a-1)}else setMes(m=>m-1) }
  const nextMes = () => { if(mes===11){setMes(0);setAño(a=>a+1)}else setMes(m=>m+1) }

  // Construir eventos por fecha
  const eventos = useMemo(() => {
    const map = {}
    const add = (fecha, ev) => { if(!fecha) return; map[fecha] = map[fecha]||[]; map[fecha].push(ev) }

    // Vencimientos de pago de OPs
    pedidos.forEach(p => {
      if (p.fechaPago) {
        const prov = proveedores.find(x=>x.id===p.proveedorId)
        add(p.fechaPago, {
          tipo:'op', id:`op-${p.id}`,
          label:`Pago OP #${String(p.id).padStart(4,'0')} — ${p.proveedorNombre}`,
          monto: p.total,
          color:'#ef4444',
          estado: p.estadoPago || 'pendiente'
        })
      }
    })

    // Pagos de servicios — generar ocurrencias para los próximos 12 meses
    const mesesRepeticion = { mensual:1, bimestral:2, trimestral:3, anual:12, unico:0 }
    pagosServicios.forEach(ps => {
      if (!ps.fechaProx) return
      const rep = mesesRepeticion[ps.frecuencia] ?? 0
      // Agregar la fecha próxima guardada
      const addEvent = (fecha) => add(fecha, {
        tipo:'servicio', id:`serv-${ps.id}-${fecha}`,
        label: ps.nombre,
        monto: ps.monto,
        color:'#a855f7',
        estado: 'pendiente',
        psId: ps.id
      })
      addEvent(ps.fechaProx)
      // Para frecuencias repetitivas, generar los próximos 12 meses
      if (rep > 0) {
        const base = new Date(ps.fechaProx + 'T00:00:00')
        for (let i = 1; i <= Math.ceil(12 / rep); i++) {
          const next = new Date(base)
          next.setMonth(next.getMonth() + rep * i)
          addEvent(next.toISOString().slice(0, 10))
        }
      }
    })

    // Ventas del mes (para ver totales diarios)
    ventas.filter(v=>v.tipo!=='presupuesto'&&v.tipo!=='remito'&&v.estado==='completada').forEach(v => {
      if (v.fecha) {
        add(v.fecha, { tipo:'venta', id:`v-${v.id}`, label:`Venta #${String(v.id).padStart(4,'0')}`, monto:v.total, color:'#22c55e' })
      }
    })

    return map
  }, [pedidos, ventas, pagosServicios, proveedores])

  // Días del mes
  const primerDia = new Date(año, mes, 1).getDay()
  const diasEnMes = new Date(año, mes+1, 0).getDate()
  const hoyStr    = today()

  // Resumen del día seleccionado
  const evsDia = diaSelec ? (eventos[diaSelec]||[]) : []
  const totalVentasDia = evsDia.filter(e=>e.tipo==='venta').reduce((a,b)=>a+b.monto,0)
  const totalPagosDia  = evsDia.filter(e=>e.tipo==='op'||e.tipo==='servicio').reduce((a,b)=>a+b.monto,0)

  const saveServicio = () => {
    if (!form.nombre || !form.monto || !form.fechaProx) return
    setPagosServicios(prev=>[...prev,{...form,id:nextId(prev),monto:+form.monto}])
    setModal(null)
    setForm({ nombre:'', monto:'', fechaProx:today(), frecuencia:'mensual', nota:'' })
  }

  // Auto-avanzar fecha base cuando ya pasó (la próxima repetición)
  React.useEffect(() => {
    const hoyDate = new Date(hoyStr+'T00:00:00')
    const mesesMap = { mensual:1, bimestral:2, trimestral:3, anual:12 }
    const updated = pagosServicios.map(ps => {
      if (!ps.fechaProx || ps.frecuencia==='unico') return ps
      const fp = new Date(ps.fechaProx+'T00:00:00')
      if (fp >= hoyDate) return ps
      // La fecha base está en el pasado — avanzar al próximo ciclo
      const m = mesesMap[ps.frecuencia] || 1
      const next = new Date(fp)
      while (next < hoyDate) next.setMonth(next.getMonth() + m)
      return { ...ps, fechaProx: next.toISOString().slice(0,10) }
    })
    const hasChange = updated.some((ps,i)=>ps.fechaProx!==pagosServicios[i]?.fechaProx)
    if (hasChange) setPagosServicios(updated)
  }, [pagosServicios.length]) // re-run when services are added/removed
  const deleteServicio = (id) => { setPagosServicios(prev=>prev.filter(p=>p.id!==id)) }

  // Días con alertas (pagos vencidos o próximos a vencer ≤7 días)
  const alertDates = new Set()
  Object.entries(eventos).forEach(([fecha, evs]) => {
    if (evs.some(e=>e.tipo==='op'||e.tipo==='servicio')) {
      const d = parseLocal(fecha)
      if (d) {
        const diff = (d - new Date(hoyStr+'T00:00:00'))/(1000*60*60*24)
        if (diff >= 0 && diff <= 7) alertDates.add(fecha)
        if (diff < 0) alertDates.add(fecha)  // vencidos
      }
    }
  })

  // Resumen del mes
  const totalVentasMes = Object.entries(eventos)
    .filter(([f])=>f.startsWith(`${año}-${String(mes+1).padStart(2,'0')}`))
    .flatMap(([,evs])=>evs.filter(e=>e.tipo==='venta'))
    .reduce((a,b)=>a+b.monto,0)
  const totalPagosMes = Object.entries(eventos)
    .filter(([f])=>f.startsWith(`${año}-${String(mes+1).padStart(2,'0')}`))
    .flatMap(([,evs])=>evs.filter(e=>e.tipo==='op'||e.tipo==='servicio'))
    .reduce((a,b)=>a+b.monto,0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.white }}>Calendario</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:C.muted }}>Vencimientos · Ventas · Pagos de servicios</p>
        </div>
        <button style={s.btn()} onClick={()=>setModal('addServicio')}><Plus size={14}/> Agregar servicio/pago fijo</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16 }}>
        {/* Calendariо */}
        <div style={s.card}>
          {/* Navegación mes */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <button onClick={prevMes} style={{ background:'none', border:`1px solid ${C.border}`, color:C.subtle, borderRadius:8, padding:'6px 10px', cursor:'pointer' }}><ChevronLeft size={16}/></button>
            <span style={{ fontSize:16, fontWeight:700, color:C.white }}>{MESES[mes]} {año}</span>
            <button onClick={nextMes} style={{ background:'none', border:`1px solid ${C.border}`, color:C.subtle, borderRadius:8, padding:'6px 10px', cursor:'pointer' }}><ChevronRight size={16}/></button>
          </div>

          {/* Resumen del mes */}
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            {[
              {label:'Ventas del mes', monto:totalVentasMes, color:C.green},
              {label:'Pagos del mes',  monto:totalPagosMes,  color:C.red},
              {label:'Balance',        monto:totalVentasMes-totalPagosMes, color:totalVentasMes>=totalPagosMes?C.green:C.red},
            ].map(r=>(
              <div key={r.label} style={{ flex:1, background:C.surface, borderRadius:8, padding:'10px 12px', textAlign:'center', border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{r.label}</div>
                <div style={{ fontFamily:'monospace', fontWeight:800, color:r.color, fontSize:15 }}>{fmt(r.monto)}</div>
              </div>
            ))}
          </div>

          {/* Cabecera días */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {DIAS.map(d=>(
              <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:C.muted, padding:'4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Grid de días */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {/* Celdas vacías iniciales */}
            {Array.from({length:primerDia}).map((_,i)=>(
              <div key={`empty-${i}`} style={{ minHeight:72, borderRadius:8 }}/>
            ))}
            {/* Días del mes */}
            {Array.from({length:diasEnMes},(_,i)=>i+1).map(d=>{
              const fecha  = dateStr(año,mes,d)
              const evs    = eventos[fecha]||[]
              const isHoy  = fecha===hoyStr
              const isSel  = fecha===diaSelec
              const isAlert= alertDates.has(fecha)
              const ventasD= evs.filter(e=>e.tipo==='venta').reduce((a,b)=>a+b.monto,0)
              const pagosD = evs.filter(e=>e.tipo==='op'||e.tipo==='servicio')
              return (
                <div key={d} onClick={()=>setDiaSelec(isSel?null:fecha)}
                  style={{ minHeight:72, borderRadius:8, padding:'6px 7px', cursor:'pointer',
                    border:`1px solid ${isSel?C.accent:isAlert?C.red:C.border}`,
                    background: isSel?`${C.accent}18`:isHoy?`${C.accent}08`:C.surface,
                    transition:'border-color 0.15s, background 0.15s'
                  }}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.borderColor=C.accent}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=isSel?C.accent:isAlert?C.red:C.border}}>
                  <div style={{ fontSize:12, fontWeight:isHoy?800:600, color:isHoy?C.accent:C.white, marginBottom:3 }}>
                    {d}{isHoy&&<span style={{ fontSize:9, background:C.accent, color:'#fff', borderRadius:4, padding:'1px 4px', marginLeft:4 }}>hoy</span>}
                  </div>
                  {ventasD>0 && (
                    <div style={{ fontSize:9, color:C.green, fontFamily:'monospace', fontWeight:700, marginBottom:1 }}>
                      +{fmt(ventasD)}
                    </div>
                  )}
                  {pagosD.map((ev,i)=>(
                    <div key={i} style={{ fontSize:9, borderRadius:3, padding:'1px 4px', background:`${ev.color}22`, color:ev.color, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      ⚠ {fmt(ev.monto)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <div style={{ display:'flex', gap:16, marginTop:14, fontSize:11, color:C.muted }}>
            {[{color:'#22c55e',label:'Ventas'},{color:'#ef4444',label:'Pago OP'},{color:'#a855f7',label:'Servicio fijo'}].map(l=>(
              <span key={l.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:l.color, display:'inline-block' }}/>
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* Panel lateral — detalle del día + lista servicios */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Detalle del día */}
          {diaSelec ? (
            <div style={s.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontWeight:700, color:C.white, fontSize:14 }}>{fmtDate(diaSelec)}</div>
                <button onClick={()=>setDiaSelec(null)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={14}/></button>
              </div>
              {evsDia.length===0 && <div style={{ color:C.muted, fontSize:12, textAlign:'center', padding:'20px 0' }}>Sin eventos este día</div>}
              {totalVentasDia>0 && (
                <div style={{ padding:'8px 10px', background:`${C.green}12`, borderRadius:8, marginBottom:8, border:`1px solid ${C.green}30` }}>
                  <div style={{ fontSize:11, color:C.green, fontWeight:700 }}>💰 Ventas del día</div>
                  <div style={{ fontFamily:'monospace', fontWeight:800, color:C.green, fontSize:16 }}>{fmt(totalVentasDia)}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{evsDia.filter(e=>e.tipo==='venta').length} transacción(es)</div>
                </div>
              )}
              {evsDia.filter(e=>e.tipo==='op'||e.tipo==='servicio').map(ev=>(
                <div key={ev.id}
                  onClick={()=>{ if(ev.tipo==='op'){ const p=pedidos.find(x=>`op-${x.id}`===ev.id); if(p) setOpDetalle(p) } }}
                  style={{ padding:'8px 10px', background:`${ev.color}12`, borderRadius:8, marginBottom:6,
                    border:`1px solid ${ev.color}30`, cursor:ev.tipo==='op'?'pointer':'default',
                    transition:'background 0.15s' }}
                  onMouseEnter={e=>{ if(ev.tipo==='op') e.currentTarget.style.background=`${ev.color}22` }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=`${ev.color}12` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:10, color:ev.color, fontWeight:700, textTransform:'uppercase' }}>
                      {ev.tipo==='op'?'Pago OP':'Servicio'} {ev.tipo==='op'&&<span style={{fontSize:9,marginLeft:4,opacity:0.7}}>👁 ver detalle</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.white, marginTop:2 }}>{ev.label}</div>
                  <div style={{ fontFamily:'monospace', fontWeight:800, color:ev.color, fontSize:15 }}>{fmt(ev.monto)}</div>
                </div>
              ))}
              {totalPagosDia>0 && (
                <div style={{ borderTop:`1px solid ${C.border}`, marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:C.muted }}>Total pagos</span>
                  <span style={{ fontFamily:'monospace', fontWeight:800, color:C.red }}>{fmt(totalPagosDia)}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...s.card, textAlign:'center', padding:32 }}>
              <div style={{ fontSize:13, color:C.muted }}>Hacé clic en un día para ver el detalle</div>
            </div>
          )}

          {/* Pagos fijos / servicios */}
          <div style={s.card}>
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>
              Pagos fijos / Servicios
            </div>
            {pagosServicios.length===0 ? (
              <div style={{ color:C.muted, fontSize:12, textAlign:'center', padding:'12px 0' }}>
                Sin servicios cargados
              </div>
            ) : (
              pagosServicios.map(ps=>{
                const d = parseLocal(ps.fechaProx)
                const diff = d ? Math.round((d - new Date(hoyStr+'T00:00:00'))/(1000*60*60*24)) : null
                const vence = diff!==null && diff<=7
                return (
                  <div key={ps.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:vence?C.red:C.white }}>{ps.nombre}</div>
                      <div style={{ fontSize:11, color:C.muted }}>
                        {ps.fechaProx && `Próximo: ${fmtDate(ps.fechaProx)}`}
                        {diff!==null && diff<=7 && diff>=0 && <span style={{ color:C.red, fontWeight:700 }}> ⚠ en {diff} día{diff!==1?'s':''}</span>}
                        {diff!==null && diff<0 && <span style={{ color:C.red, fontWeight:700 }}> ❌ VENCIDO</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ fontFamily:'monospace', fontWeight:700, color:C.accent, fontSize:13 }}>{fmt(+ps.monto)}</div>
                      <button onClick={()=>deleteServicio(ps.id)} style={{ background:'none', border:'none', color:C.red, cursor:'pointer', opacity:0.6 }}><Trash2 size={12}/></button>
                    </div>
                  </div>
                )
              })
            )}
            <button style={{ ...s.btn('ghost'), width:'100%', justifyContent:'center', marginTop:10, fontSize:12 }}
              onClick={()=>setModal('addServicio')}><Plus size={12}/> Agregar</button>
          </div>

          {/* Próximos vencimientos */}
          {(() => {
            const proximos = pedidos
              .filter(p=>p.fechaPago)
              .map(p=>({ ...p, diff: Math.round((parseLocal(p.fechaPago)-new Date(hoyStr+'T00:00:00'))/(1000*60*60*24)) }))
              .filter(p=>p.diff>=-3 && p.diff<=30)
              .sort((a,b)=>a.diff-b.diff)
            if (proximos.length===0) return null
            return (
              <div style={s.card}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>Vencimientos OP</div>
                {proximos.map(p=>(
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:`1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:p.diff<0?C.red:p.diff<=7?C.yellow:C.white }}>
                        OP #{String(p.id).padStart(4,'0')} · {p.proveedorNombre}
                      </div>
                      <div style={{ fontSize:10, color:C.muted }}>
                        {p.diff<0 ? <span style={{color:C.red}}>Vencido hace {Math.abs(p.diff)} días</span>
                         : p.diff===0 ? <span style={{color:C.red}}>Vence HOY</span>
                         : p.diff<=7 ? <span style={{color:C.yellow}}>En {p.diff} días ({fmtDate(p.fechaPago)})</span>
                         : `${fmtDate(p.fechaPago)}`}
                      </div>
                    </div>
                    <div style={{ fontFamily:'monospace', fontWeight:700, color:p.diff<0?C.red:C.accent, fontSize:13 }}>{fmt(p.total)}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Modal detalle OP */}
      {opDetalle && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300 }} onClick={()=>setOpDetalle(null)}>
          <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:24,width:520,maxWidth:'95vw',maxHeight:'85vh',overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800,color:C.white,fontSize:16 }}>OP #{String(opDetalle.id).padStart(4,'0')}</div>
                <div style={{ fontSize:12,color:C.muted,marginTop:2 }}>
                  {opDetalle.proveedorNombre} · {fmtDate(opDetalle.fecha)}
                  {opDetalle.fechaPago && <> · <span style={{color:C.yellow}}>Vence: {fmtDate(opDetalle.fechaPago)}</span></>}
                </div>
              </div>
              <button onClick={()=>setOpDetalle(null)} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:20 }}>✕</button>
            </div>
            <table style={s.table}>
              <thead><tr>{['Producto','SKU','Qty','Costo unit.','Subtotal'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {opDetalle.items.map((it,i)=>(
                  <tr key={i}>
                    <td style={{...s.td,fontWeight:500,color:C.white}}>{it.nombre}</td>
                    <td style={{...s.td,fontFamily:'monospace',fontSize:11,color:C.muted}}>{it.sku||'—'}</td>
                    <td style={{...s.td,fontFamily:'monospace',fontWeight:700}}>{it.qty}</td>
                    <td style={{...s.td,fontFamily:'monospace'}}>{fmt(it.costo)}</td>
                    <td style={{...s.td,fontFamily:'monospace',color:C.accent,fontWeight:700}}>{fmt(it.costo*it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop:`2px solid ${C.border}`,marginTop:4,paddingTop:12 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end' }}>
                <div style={{ fontSize:11,color:C.muted }}>
                  <div>s/IVA: {fmt(Math.round(opDetalle.total/1.21))}</div>
                  <div>IVA 21%: {fmt(Math.round(opDetalle.total-opDetalle.total/1.21))}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12,color:C.muted }}>Total</div>
                  <div style={{ fontFamily:'monospace',fontSize:22,fontWeight:800,color:C.accent }}>{fmt(opDetalle.total)}</div>
                </div>
              </div>
            </div>
            {opDetalle.nota && <div style={{ marginTop:10,padding:'8px 12px',background:C.surface,borderRadius:8,fontSize:12,color:C.muted }}>📝 {opDetalle.nota}</div>}
            <div style={{ display:'flex',justifyContent:'flex-end',marginTop:14 }}>
              <button style={s.btn('ghost')} onClick={()=>setOpDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar servicio */}
      {modal==='addServicio' && (
        <Modal title="Agregar pago fijo / servicio" onClose={()=>setModal(null)}>
          <FF label="Nombre del servicio"><input style={s.input} value={form.nombre} placeholder="Alquiler, Internet, Luz..." onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></FF>
          <div style={s.grid(2)}>
            <FF label="Monto ($)"><input style={s.input} type="number" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))}/></FF>
            <FF label="Próximo vencimiento"><input style={s.input} type="date" value={form.fechaProx} onChange={e=>setForm(f=>({...f,fechaProx:e.target.value}))}/></FF>
          </div>
          <FF label="Frecuencia">
            <select style={s.input} value={form.frecuencia} onChange={e=>setForm(f=>({...f,frecuencia:e.target.value}))}>
              <option value="mensual">Mensual</option>
              <option value="bimestral">Bimestral</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
              <option value="unico">Único</option>
            </select>
          </FF>
          <FF label="Nota (opcional)"><input style={s.input} value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))}/></FF>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <button style={s.btn('ghost')} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={s.btn()} onClick={saveServicio}><CheckCircle2 size={14}/> Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
