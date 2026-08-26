import React, { useState, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, AlertTriangle, TrendingUp } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt, fmtDate, today, getNow } from '../utils'
import { CATS_DEFAULT } from '../data'
import { PeriodFilter, SectionTitle } from './Shared'

// ── helpers ──────────────────────────────────────────────────────────────────
// FIX: días 29/30/31 van a S4 (Math.min evita índice 4)
function semanaDelMes(fecha) { return Math.min(Math.floor((fecha.getDate() - 1) / 7), 3) }

// Parsear fecha como hora local (evita bug de timezone UTC-3)
function parseLocal(str) {
  if (!str) return new Date()
  const [y,m,d] = str.split('-').map(Number)
  return new Date(y, m-1, d)
}


function buildVentasData(ventas, period) {
  const ahora  = getNow()
  const hoyStr = today()
  const real   = ventas.filter(v => v.tipo !== 'presupuesto' && v.estado === 'completada')

  if (period === 'dia') {
    const cur   = ahora.getHours()
    const HORAS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
    const sinH  = real.filter(v => v.fecha === hoyStr && !v.hora).reduce((a,b)=>a+b.total,0)
    return HORAS.filter(h => h <= cur).map(h => ({
      t: `${h}hs`,
      v: real.filter(v => v.fecha===hoyStr && v.hora && parseInt(v.hora)===h).reduce((a,b)=>a+b.total,0)
         + (h===cur ? sinH : 0)
    }))
  }
  if (period === 'semana') {
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    return Array.from({length:7},(_,i)=>{
      const d=new Date(ahora); d.setDate(d.getDate()-(6-i))
      const str=d.toISOString().slice(0,10)
      return { t:dias[d.getDay()], v:real.filter(x=>x.fecha===str).reduce((a,b)=>a+b.total,0) }
    })
  }
  if (period === 'mes') {
    return ['S1','S2','S3','S4'].map((t,i)=>({
      t,
      v: real.filter(x=>{
        const d=parseLocal(x.fecha)
        return d.getMonth()===ahora.getMonth() && d.getFullYear()===ahora.getFullYear() && semanaDelMes(d)===i
      }).reduce((a,b)=>a+b.total,0)
    }))
  }
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((t,i)=>({
    t,
    v: real.filter(x=>{ const d=parseLocal(x.fecha); return d.getMonth()===i && d.getFullYear()===ahora.getFullYear() }).reduce((a,b)=>a+b.total,0)
  }))
}

// FIX: compras lee pedidos recibidos, no pagos
function buildComprasData(pedidos, period) {
  const ahora  = getNow()
  const hoyStr = today()
  const real   = pedidos.filter(p => p.estado === 'recibido')

  if (period === 'dia') {
    const cur=ahora.getHours(); const HORAS=[8,9,10,11,12,13,14,15,16,17,18,19]
    const tot=real.filter(p=>p.fecha===hoyStr).reduce((a,b)=>a+b.total,0)
    return HORAS.filter(h=>h<=cur).map(h=>({ t:`${h}hs`, v:h===cur?tot:0 }))
  }
  if (period === 'semana') {
    const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    return Array.from({length:7},(_,i)=>{
      const d=new Date(ahora); d.setDate(d.getDate()-(6-i))
      const str=d.toISOString().slice(0,10)
      return { t:dias[d.getDay()], v:real.filter(p=>p.fecha===str).reduce((a,b)=>a+b.total,0) }
    })
  }
  if (period === 'mes') {
    return ['S1','S2','S3','S4'].map((t,i)=>({
      t,
      v: real.filter(p=>{ const d=parseLocal(p.fecha); return d.getMonth()===ahora.getMonth() && d.getFullYear()===ahora.getFullYear() && semanaDelMes(d)===i }).reduce((a,b)=>a+b.total,0)
    }))
  }
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((t,i)=>({
    t,
    v: real.filter(p=>{ const d=parseLocal(p.fecha); return d.getMonth()===i && d.getFullYear()===ahora.getFullYear() }).reduce((a,b)=>a+b.total,0)
  }))
}

const FORMAS_PAGO = ['Efectivo','Transferencia','QR','Tarjeta','Cuenta Cte.']
const PAGO_COLORS = { 'Efectivo':'#22c55e','Transferencia':'#3b82f6','QR':'#a855f7','Tarjeta':'#f97316','Cuenta Cte.':'#eab308' }

// FIX: contadores se resetean automáticamente al cambiar el día
const CONT_KEY = 'ferreteria_contadores'
const HOY_STR  = () => today()
function loadCont() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONT_KEY) || 'null')
    if (!raw || raw.fecha !== HOY_STR()) return { compro:0, noCompro:0, noTengo:0, fecha:HOY_STR() }
    return raw
  } catch { return { compro:0, noCompro:0, noTengo:0, fecha:HOY_STR() } }
}
function saveCont(c) { try { localStorage.setItem(CONT_KEY, JSON.stringify(c)) } catch {} }

// ── componente ────────────────────────────────────────────────────────────────
export default function Dashboard({ productos, ventas, clientes, pedidos=[], pagos=[], proveedores=[], setActive, allCats, pagosServicios=[] }) {
  const { C, s } = useTheme()
  const [ventasPeriod,  setVentasPeriod]  = useState('mes')
  const [comprasPeriod, setComprasPeriod] = useState('mes')
  const [catPeriod,     setCatPeriod]     = useState('mes')
  const [cont, setCont] = useState(loadCont)

  const incCont = key => setCont(prev => { const n={...prev,[key]:(prev[key]||0)+1,fecha:HOY_STR()}; saveCont(n); return n })
  const decCont = key => setCont(prev => { const n={...prev,[key]:Math.max(0,(prev[key]||0)-1),fecha:HOY_STR()}; saveCont(n); return n })
  const resetCont = () => { const n={compro:0,noCompro:0,noTengo:0,fecha:HOY_STR()}; setCont(n); saveCont(n) }

  const stockBajo  = productos.filter(p=>p.stock<=p.minStock).length
  const hoy        = today()

  // Deuda con proveedores: OPs recibidas menos pagos
  const deudaProv = useMemo(()=>{
    return proveedores.reduce((total, prov)=>{
      const recibido = pedidos.filter(p=>p.proveedorId===prov.id&&p.estado==='recibido').reduce((a,b)=>a+b.total,0)
      const pagado   = pagos.filter(p=>p.provId===prov.id).reduce((a,b)=>a+b.monto,0)
      return total + Math.max(0, recibido - pagado)
    },0)
  },[proveedores,pedidos,pagos])
  const ventasHoy  = ventas.filter(v=>v.fecha===hoy && v.estado==='completada')
  const totalHoy   = ventasHoy.reduce((a,b)=>a+b.total,0)
  const costoHoy   = ventasHoy.flatMap(v=>v.items).reduce((a,it)=>{ const p=productos.find(x=>x.id===it.prodId); return a+(p?p.costo*it.qty:0) },0)
  const margenHoy  = totalHoy>0 ? ((totalHoy-costoHoy)/totalHoy*100).toFixed(1) : 0


  const cobrosHoy = useMemo(()=>{
    const res={}; FORMAS_PAGO.forEach(f=>{res[f]=0})
    ventasHoy.filter(v=>v.formaPago).forEach(v=>{res[v.formaPago]=(res[v.formaPago]||0)+v.total})
    return res
  },[ventasHoy])
  const totalCobrado = Object.values(cobrosHoy).reduce((a,b)=>a+b,0)

  const ventasChart  = useMemo(()=>buildVentasData(ventas,ventasPeriod),[ventas,ventasPeriod])
  const comprasChart = useMemo(()=>buildComprasData(pedidos,comprasPeriod),[pedidos,comprasPeriod])
  const totalPeriod  = useMemo(()=>ventasPeriod==='dia'?totalHoy:ventasChart.reduce((a,b)=>a+b.v,0),[ventasChart,ventasPeriod,totalHoy])

  const catData = useMemo(()=>{
    const ahora = getNow(), hoyStr = today()
    const real  = ventas.filter(v => v.tipo !== 'presupuesto' && v.estado === 'completada')
    
    let fil = real
    if (catPeriod === 'dia') {
      fil = real.filter(v => v.fecha === hoyStr)
    } else if (catPeriod === 'semana') {
      const hace7 = new Date(ahora)
      hace7.setDate(hace7.getDate() - 6)
      hace7.setHours(0,0,0,0)
      fil = real.filter(v => {
        const d = parseLocal(v.fecha)
        return d >= hace7 && d <= ahora
      })
    } else if (catPeriod === 'mes') {
      fil = real.filter(v => {
        const d = parseLocal(v.fecha)
        return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
      })
    } else if (catPeriod === 'anio' || catPeriod === 'ano') {
      fil = real.filter(v => {
        const d = parseLocal(v.fecha)
        return d.getFullYear() === ahora.getFullYear()
      })
    }

    const cats = allCats && allCats.length > 0 ? allCats : CATS_DEFAULT
    return cats.map(cat => ({
      cat: cat.length > 8 ? cat.slice(0, 7) + '.' : cat,
      fullCat: cat,
      v: fil.flatMap(v => v.items).filter(i => productos.find(x => x.id === i.prodId)?.cat === cat)
            .reduce((a, b) => a + (b.qty || 1) * (b.precio || 0) * (1 - (b.descuento || 0) / 100), 0)
    })).filter(x => x.v > 0)
  }, [catPeriod, ventas, productos, allCats])

  const ChartCustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'none'
        }}>
          {label && (
            <div style={{ fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 3 }}>
              {label}
            </div>
          )}
          {payload.map((entry, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: idx > 0 ? 3 : 0 }}>
              {entry.color && <div style={{ width: 8, height: 8, borderRadius: 2, background: entry.color }} />}
              <span style={{ color: C.text }}>{entry.name || 'Total'}:</span>
              <span style={{ fontWeight: 800, color: C.white, fontFamily: 'monospace' }}>
                {typeof entry.value === 'number' ? fmt(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:C.white}}>Panel de Control</h1>
        <p style={{margin:'4px 0 0',fontSize:13,color:C.muted}}>Ferretería Pro · resumen operativo</p>
      </div>

      {/* KPIs */}
      <div style={s.grid(4)}>
        {[
          { label:'Ventas del período', value:fmt(totalPeriod), icon:DollarSign,    color:C.accent },
          { label:'Ticket promedio',    value:fmt(ventasHoy.length?totalHoy/ventasHoy.length:0), icon:TrendingUp, color:C.blue },
          { label:'Deuda proveedores',  value:fmt(deudaProv), icon:AlertTriangle, color:deudaProv>0?C.red:C.green },
          { label:'Alertas de stock',   value:stockBajo,        icon:AlertTriangle, color:stockBajo>0?C.yellow:C.green },
        ].map(k=>(
          <div key={k.label} style={s.kpi}>
            <div style={{background:`${k.color}20`,borderRadius:8,padding:8,width:'fit-content',marginBottom:8}}><k.icon size={18} color={k.color}/></div>
            <div style={{fontSize:22,fontWeight:800,color:C.white,fontFamily:'monospace'}}>{k.value}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Día */}
      <div style={{...s.grid(2),marginTop:16}}>
        <div style={s.card}>
          <SectionTitle>Hoy — {new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</SectionTitle>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:4}}>
            {[{label:'Facturado',value:fmt(totalHoy),color:C.accent},{label:'Costo',value:fmt(costoHoy),color:C.red},{label:'Margen',value:`${margenHoy}%`,color:C.green}].map(k=>(
              <div key={k.label} style={{padding:'10px 12px',background:C.surface,borderRadius:8}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:3,textTransform:'uppercase',letterSpacing:1}}>{k.label}</div>
                <div style={{fontSize:18,fontWeight:800,color:k.color,fontFamily:'monospace'}}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:C.muted,marginTop:8}}>{ventasHoy.length} ventas completadas hoy</div>
        </div>
        <div style={s.card}>
          <SectionTitle>Cobros por Método — Hoy</SectionTitle>
          {FORMAS_PAGO.map(f=>{
            const monto=cobrosHoy[f]||0, pct=totalCobrado>0?(monto/totalCobrado*100).toFixed(0):0
            return (
              <div key={f} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:12,color:monto>0?C.text:C.muted}}>{f}</span>
                  <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:monto>0?PAGO_COLORS[f]:C.muted}}>{fmt(monto)}</span>
                </div>
                {monto>0&&<div style={{background:C.border,borderRadius:3,height:3}}><div style={{background:PAGO_COLORS[f],height:3,borderRadius:3,width:`${pct}%`}}/></div>}
              </div>
            )
          })}
          <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0 0',borderTop:`1px solid ${C.border}`,marginTop:4}}>
            <span style={{fontSize:13,fontWeight:600,color:C.white}}>Total cobrado</span>
            <span style={{fontFamily:'monospace',fontSize:14,fontWeight:800,color:C.accent}}>{fmt(totalCobrado)}</span>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{...s.grid(2),marginTop:16}}>
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <SectionTitle>Ventas</SectionTitle><PeriodFilter value={ventasPeriod} onChange={setVentasPeriod}/>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ventasChart}>
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.3}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid}/>
              <XAxis dataKey="t" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<ChartCustomTooltip />}/>
              <Area type="monotone" dataKey="v" stroke={C.accent} strokeWidth={2} fill="url(#gv)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <SectionTitle>Compras (OPs recibidas)</SectionTitle><PeriodFilter value={comprasPeriod} onChange={setComprasPeriod}/>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={comprasChart}>
              <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={0.3}/><stop offset="100%" stopColor={C.red} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid}/>
              <XAxis dataKey="t" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<ChartCustomTooltip />}/>
              <Area type="monotone" dataKey="v" stroke={C.red} strokeWidth={2} fill="url(#gg)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cat + contadores + últimas ventas */}
      <div style={{...s.grid(2),marginTop:16}}>
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <SectionTitle>Ventas por Categoría</SectionTitle><PeriodFilter value={catPeriod} onChange={setCatPeriod}/>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={catData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid}/>
              <XAxis dataKey="cat" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<ChartCustomTooltip />}/>
              <Bar dataKey="v" fill={C.blue} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* Contadores diarios — FIX: auto-reset por fecha */}
          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <SectionTitle>Contadores del día</SectionTitle>
              <button onClick={resetCont} style={{fontSize:10,color:C.muted,background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'2px 8px',cursor:'pointer'}}>Resetear</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[{key:'compro',label:'Compró',color:C.green},{key:'noCompro',label:'No compró',color:C.yellow},{key:'noTengo',label:'No tengo',color:C.red}].map(c=>(
                <div key={c.key} style={{background:C.surface,borderRadius:8,padding:'10px 6px',textAlign:'center',border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:28,fontWeight:800,color:c.color,fontFamily:'monospace'}}>{cont[c.key]||0}</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:6}}>{c.label}</div>
                  <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                    <button onClick={()=>incCont(c.key)} style={{...s.btn('ghost'),padding:'2px 8px',fontSize:13,fontWeight:700}}>+</button>
                    <button onClick={()=>decCont(c.key)} style={{...s.btn('ghost'),padding:'2px 8px',fontSize:13,fontWeight:700}}>−</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas de stock */}
          <div style={s.card}>
            <SectionTitle>Alertas de Stock</SectionTitle>
            {productos.filter(p=>p.stock<=p.minStock).length===0
              ? <p style={{color:C.muted,fontSize:13,margin:0}}>✓ Todo en niveles normales</p>
              : productos.filter(p=>p.stock<=p.minStock).slice(0,4).map(p=>(
                <div key={p.id} onClick={()=>setActive&&setActive('inventario')}
                  style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div><div style={{fontSize:13,fontWeight:500}}>{p.nombre}</div><div style={{fontSize:11,color:C.muted}}>{p.sku}</div></div>
                  <div style={{textAlign:'right'}}><div style={{fontSize:13,color:p.stock===0?C.red:C.yellow,fontWeight:700,fontFamily:'monospace'}}>{p.stock}/{p.minStock}</div><div style={{fontSize:10,color:C.muted}}>actual/mín</div></div>
                </div>
              ))
            }
          </div>

          {/* Últimas ventas */}
          <div style={s.card}>
            <SectionTitle>Últimas Ventas</SectionTitle>
            {ventas.length===0
              ? <p style={{color:C.muted,fontSize:13,margin:0}}>Sin ventas registradas</p>
              : [...ventas].reverse().slice(0,4).map(v=>{
                const cl=clientes.find(c=>c.id===v.clienteId)
                return (
                  <div key={v.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                    <div><div style={{fontSize:13,fontWeight:500}}>{cl?.nombre||'Consumidor Final'}</div><div style={{fontSize:11,color:C.muted}}>{fmtDate(v.fecha)}</div></div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontFamily:'monospace',fontSize:13,color:C.accent,fontWeight:700}}>{fmt(v.total)}</span>
                      <span style={s.badge(v.estado==='completada'?C.green:v.tipo==='presupuesto'?C.blue:C.yellow)}>{v.tipo==='presupuesto'?'Presup.':v.estado}</span>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  )
}
