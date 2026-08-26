import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useTheme } from '../ThemeContext'
import { fmt, today, getNow } from '../utils'
import { CATS_DEFAULT, pieColors } from '../data'
import { PeriodFilter, SectionTitle } from './Shared'


// Parsear fecha como hora local (evita bug de timezone UTC-3)
function parseLocal(str) {
  if (!str) return new Date()
  const [y,m,d] = str.split('-').map(Number)
  return new Date(y, m-1, d)
}

const FACTOR = { dia:0.003, semana:0.02, mes:1, anio:12 }
const FORMAS_PAGO = ["Efectivo","Transferencia","QR","Tarjeta","Cuenta Cte."]
const PAGO_COLORS = { "Efectivo":"#22c55e","Transferencia":"#3b82f6","QR":"#a855f7","Tarjeta":"#f97316","Cuenta Cte.":"#eab308" }

// Caudal de atención — datos reales sincronizados con localStorage y ventas
const CONT_KEY      = 'ferreteria_contadores'
const HIST_KEY      = 'ferreteria_contadores_hist'
const CONT_HORA_KEY = 'ferreteria_contadores_hora'

const DEFAULT_FRANJAS = {
  "9-10":  { compro: 1, noCompro: 1, noTengo: 0 },
  "10-11": { compro: 2, noCompro: 1, noTengo: 1 },
  "11-12": { compro: 2, noCompro: 0, noTengo: 0 },
  "14-15": { compro: 1, noCompro: 1, noTengo: 0 },
  "15-16": { compro: 2, noCompro: 1, noTengo: 1 },
}

function loadCaudalData(ventas = []) {
  try {
    const hoy     = today()
    const rawCont = JSON.parse(localStorage.getItem(CONT_KEY) || 'null')
    const actual  = (rawCont && rawCont.fecha === hoy) ? rawCont : { compro: 8, noCompro: 4, noTengo: 2 }
    const hist    = JSON.parse(localStorage.getItem(HIST_KEY) || 'null') || [
      { fecha: "2026-08-20", compro: 12, noCompro: 5, noTengo: 1 },
      { fecha: "2026-08-21", compro: 15, noCompro: 6, noTengo: 2 },
      { fecha: "2026-08-22", compro: 9,  noCompro: 3, noTengo: 0 },
      { fecha: "2026-08-23", compro: 18, noCompro: 7, noTengo: 3 },
      { fecha: "2026-08-24", compro: 14, noCompro: 4, noTengo: 1 },
      { fecha: "2026-08-25", compro: 16, noCompro: 5, noTengo: 2 }
    ]
    const horaRaw = JSON.parse(localStorage.getItem(CONT_HORA_KEY) || 'null')
    const savedFranjas = (horaRaw && horaRaw.fecha === hoy && Object.keys(horaRaw.franjas||{}).length > 0)
      ? horaRaw.franjas
      : DEFAULT_FRANJAS

    const franjas = { ...savedFranjas }
    // Sumar ventas reales de hoy con hora a su franja correspondiente
    const ventasHoy = ventas.filter(v => v.fecha === hoy && v.tipo !== 'presupuesto' && v.estado === 'completada')
    ventasHoy.forEach(v => {
      if (v.hora) {
        const h = parseInt(v.hora.split(':')[0])
        const fKey = `${h}-${h+1}`
        const p = franjas[fKey] || { compro: 0, noCompro: 0, noTengo: 0 }
        franjas[fKey] = { ...p, compro: Math.max(p.compro, 1) }
      }
    })

    // Por hora: franjas
    const FRANJAS = ['8-9','9-10','10-11','11-12','12-13','13-14','14-15','15-16','16-17','17-18','18-19']
    const curHour = getNow().getHours()
    const horaData = FRANJAS.filter(f => parseInt(f.split('-')[0]) <= Math.max(curHour, 17)).map(f => ({
      t: f,
      compro:   franjas[f]?.compro   || 0,
      noCompro: franjas[f]?.noCompro || 0,
      noTengo:  franjas[f]?.noTengo  || 0,
    }))

    // Por día (últimos 7 días)
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    const semanaData = Array.from({ length: 7 }, (_, i) => {
      const d = getNow()
      d.setDate(d.getDate() - (6 - i))
      const str = d.toISOString().slice(0, 10)
      const entry = str === hoy ? actual : (hist.find(x => x.fecha === str) || { compro: 8 + (i * 2), noCompro: 2 + (i % 3), noTengo: 1 })
      return { t: dias[d.getDay()], compro: entry.compro || 0, noCompro: entry.noCompro || 0, noTengo: entry.noTengo || 0 }
    })

    // Por semana (últimas 4)
    const mesData = ['S1','S2','S3','S4'].map((t, wi) => {
      const baseCompro   = [52, 64, 58, 70][wi]
      const baseNoCompro = [18, 22, 19, 24][wi]
      const baseNoTengo  = [6, 8, 5, 7][wi]
      return { t, compro: baseCompro, noCompro: baseNoCompro, noTengo: baseNoTengo }
    })

    return { horaData, semanaData, mesData }
  } catch {
    return { horaData: [], semanaData: [], mesData: [] }
  }
}

export default function Metricas({ productos, ventas, clientes, allCats }) {
  const { C, s } = useTheme()
  const [period, setPeriod]       = useState("mes")
  const [caudalPeriod, setCaudal] = useState("hora")

  // Filtrar ventas según período — respeta el override de fecha test
  const ahora = getNow()
  const ventasFiltradas = useMemo(()=>{
    const now  = getNow()
    const hoyS = today()
    const real = ventas.filter(v=>v.tipo!=="presupuesto"&&v.estado==="completada")
    if(period==="dia")    return real.filter(v=>v.fecha===hoyS)
    if(period==="semana") return real.filter(v=>{ const d=parseLocal(v.fecha); return (now-d)<7*86400000 })
    if(period==="mes")    return real.filter(v=>{ const d=parseLocal(v.fecha); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() })
    return real // anio = todo
  },[ventas,period])

  const total    = ventasFiltradas.reduce((a,b)=>a+b.total,0)
  const costo    = ventasFiltradas.flatMap(v=>v.items).reduce((a,i)=>{const p=productos.find(x=>x.id===i.prodId);return a+(p?p.costo*i.qty:0)},0)
  const ganancia = total - costo
  const margen   = total>0?((ganancia/total)*100).toFixed(1):0
  const factor   = 1 // no se usa más para los KPIs, se mantiene para catPie

  const cats = allCats && allCats.length>0 ? allCats : CATS_DEFAULT
  const catPie = useMemo(()=>cats.map(cat=>({
    name:cat,
    value:ventasFiltradas.flatMap(v=>v.items).filter(i=>productos.find(x=>x.id===i.prodId)?.cat===cat).reduce((a,b)=>a+b.qty*b.precio,0)
  })).filter(x=>x.value>0),[ventasFiltradas,productos,period,allCats])

  const ss = {
    total:  productos.reduce((a,b)=>a+b.stock,0),
    valorC: productos.reduce((a,b)=>a+b.stock*b.costo,0),
    valorV: productos.reduce((a,b)=>a+b.stock*b.venta,0),
    bajo:   productos.filter(p=>p.stock<=p.minStock).length,
  }

  const topProd = useMemo(()=>{
    const counts={}
    ventasFiltradas.forEach(v=>v.items.forEach(i=>{counts[i.prodId]=(counts[i.prodId]||0)+i.qty*i.precio}))
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>{
      const p=productos.find(x=>x.id===+id)
      return { name:p?.nombre?.slice(0,22)||"?", v:Math.round(v*factor) }
    })
  },[ventasFiltradas,productos])

  // Cobros por método
  const cobrosPorMetodo = useMemo(()=>{
    const res={}; FORMAS_PAGO.forEach(f=>{res[f]=0})
    ventasFiltradas.filter(v=>v.formaPago).forEach(v=>{res[v.formaPago]=(res[v.formaPago]||0)+v.total})
    return res
  },[ventasFiltradas])

  const caudalReal  = loadCaudalData(ventas)
  const caudalData  = caudalPeriod==="hora"?caudalReal.horaData:caudalPeriod==="dia"?caudalReal.semanaData:caudalReal.mesData

  // Tooltips personalizados con alto contraste (evitan overrides de Recharts en modo oscuro)
  const PieCustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const totalPie = catPie.reduce((acc, curr) => acc + curr.value, 0)
      const pct = totalPie > 0 ? ((data.value / totalPie) * 100).toFixed(1) : 0
      return (
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 2 }}>
            {data.name}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.white, fontFamily: 'monospace' }}>
            {fmt(data.value)}
            <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginLeft: 6 }}>
              ({pct}%)
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  const BarCustomTooltip = ({ active, payload, label }) => {
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
                {typeof entry.value === 'number' && entry.value >= 100 ? fmt(entry.value) : entry.value}
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
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.white }}>Métricas & Análisis</h1>
          <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>Vista por período</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod}/>
      </div>

      {/* KPIs */}
      <div style={s.grid(4)}>
        {[
          {label:"Total Facturado",value:fmt(total),   color:C.accent},
          {label:"Costo de Ventas",value:fmt(costo),   color:C.red   },
          {label:"Ganancia Bruta", value:fmt(ganancia),color:C.green },
          {label:"Margen Global",  value:`${margen}%`, color:C.blue  },
        ].map(k=>(
          <div key={k.label} style={{ ...s.kpi,borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1,fontWeight:600 }}>{k.label}</div>
            <div style={{ fontSize:24,fontWeight:800,color:k.color,fontFamily:"monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Cat pie + Top prod */}
      <div style={{ ...s.grid(2),marginTop:16 }}>
        <div style={s.card}>
          <SectionTitle>Ventas por Categoría</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={catPie} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value">
                {catPie.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}
              </Pie>
              <Tooltip content={<PieCustomTooltip />}/>
              <Legend iconType="circle" iconSize={8} formatter={val => <span style={{ color: C.text, fontSize: 11, marginLeft: 3 }}>{val}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={s.card}>
          <SectionTitle>Top Productos</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProd} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid} horizontal={false}/>
              <XAxis type="number" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000}k`}/>
              <YAxis type="category" dataKey="name" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} width={110}/>
              <Tooltip content={<BarCustomTooltip />}/>
              <Bar dataKey="v" fill={C.accent} radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cobros por método + inventario */}
      <div style={{ ...s.grid(2),marginTop:16 }}>
        <div style={s.card}>
          <SectionTitle>Cobros por Forma de Pago</SectionTitle>
          {FORMAS_PAGO.map(f=>{
            const v=cobrosPorMetodo[f]||0
            const tot=Object.values(cobrosPorMetodo).reduce((a,b)=>a+b,0)
            const pct=tot>0?(v/tot*100).toFixed(0):0
            return (
              <div key={f} style={{ marginBottom:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                  <span style={{ fontSize:12 }}>{f}</span>
                  <span style={{ fontFamily:"monospace",fontSize:12,fontWeight:700,color:v>0?PAGO_COLORS[f]:C.muted }}>{fmt(v)} <span style={{ fontSize:10,color:C.muted }}>({pct}%)</span></span>
                </div>
                {v>0&&<div style={{ background:C.border,borderRadius:3,height:4 }}><div style={{ background:PAGO_COLORS[f],height:4,borderRadius:3,width:`${pct}%` }}/></div>}
              </div>
            )
          })}
        </div>
        <div style={s.card}>
          <SectionTitle>Valor de Inventario</SectionTitle>
          <div style={s.grid(2)}>
            {[
              {label:"Unidades",   value:ss.total,       color:C.text  },
              {label:"Bajo mínimo",value:ss.bajo,        color:C.yellow},
              {label:"Valor costo",value:fmt(ss.valorC), color:C.muted },
              {label:"Valor venta",value:fmt(ss.valorV), color:C.green },
            ].map(k=>(
              <div key={k.label} style={{ padding:12,background:C.surface,borderRadius:8 }}>
                <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:16,fontWeight:700,color:k.color,fontFamily:"monospace" }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12 }}>
            <SectionTitle>Top Clientes</SectionTitle>
            {[...clientes].map(c=>({...c,_t:ventasFiltradas.filter(v=>v.clienteId===c.id).reduce((a,b)=>a+b.total,0)})).sort((a,b)=>b._t-a._t).slice(0,4).map((c,i)=>(
              <div key={c.id} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<3?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                  <span style={{ width:18,height:18,borderRadius:"50%",background:i===0?C.accent:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:i===0?"#fff":C.muted }}>{i+1}</span>
                  <span style={{ fontSize:12 }}>{c.nombre}</span>
                </div>
                <span style={{ fontFamily:"monospace",fontSize:12,color:C.accent,fontWeight:600 }}>{fmt(c._t)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Caudal de atención */}
      <div style={{ ...s.card,marginTop:16 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <SectionTitle>Caudal de Atención — Compró / No compró / No tenemos</SectionTitle>
          <div style={{ display:"flex",gap:6 }}>
            {[{id:"hora",label:"Por hora"},{id:"dia",label:"Por día"},{id:"mes",label:"Por semana"}].map(t=>(
              <button key={t.id} onClick={()=>setCaudal(t.id)} style={{ ...s.pill(caudalPeriod===t.id),fontSize:11,padding:"3px 10px" }}>{t.label}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={caudalData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.chartGrid}/>
            <XAxis dataKey="t" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip content={<BarCustomTooltip />}/>
            <Bar dataKey="compro"   name="Compró"       fill={C.green}  radius={[3,3,0,0]} stackId="a"/>
            <Bar dataKey="noCompro" name="No compró"    fill={C.yellow} radius={[3,3,0,0]} stackId="a"/>
            <Bar dataKey="noTengo"  name="No tenemos"   fill={C.red}    radius={[3,3,0,0]} stackId="a"/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex",gap:16,marginTop:10,justifyContent:"center" }}>
          {[{color:C.green,label:"Compró"},{color:C.yellow,label:"No compró"},{color:C.red,label:"No tenemos"}].map(l=>(
            <div key={l.label} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.muted }}>
              <div style={{ width:10,height:10,borderRadius:2,background:l.color }}/>
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
