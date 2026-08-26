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

// Caudal de atención — datos REALES desde localStorage
const CONT_KEY      = 'ferreteria_contadores'
const HIST_KEY      = 'ferreteria_contadores_hist'
const CONT_HORA_KEY = 'ferreteria_contadores_hora'  // {fecha, franjas:{"8-9":{compro,noCompro,noTengo},...}}

function loadCaudalData() {
  try {
    const hoy    = today()
    const actual = JSON.parse(localStorage.getItem(CONT_KEY)||'null')||{compro:0,noCompro:0,noTengo:0}
    const hist   = JSON.parse(localStorage.getItem(HIST_KEY)||'[]')
    const horaRaw= JSON.parse(localStorage.getItem(CONT_HORA_KEY)||'null')

    // Por hora: franjas reales de hoy
    const FRANJAS = ['8-9','9-10','10-11','11-12','12-13','13-14','14-15','15-16','16-17','17-18','18-19','19-20','20-21','21-22','22-23']
    const curHour = getNow().getHours()
    const franjas = (horaRaw && horaRaw.fecha===hoy) ? horaRaw.franjas : {}
    const horaData = FRANJAS.filter(f=>parseInt(f.split('-')[0])<=curHour).map(f=>({
      t:f,
      compro:   franjas[f]?.compro   ||0,
      noCompro: franjas[f]?.noCompro ||0,
      noTengo:  franjas[f]?.noTengo  ||0,
    }))

    // Por día (últimos 7)
    const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    const semanaData = Array.from({length:7},(_,i)=>{
      const d=getNow(); d.setDate(d.getDate()-(6-i))
      const str=d.toISOString().slice(0,10)
      const entry=str===hoy?actual:hist.find(x=>x.fecha===str)||{compro:0,noCompro:0,noTengo:0}
      return {t:dias[d.getDay()],compro:entry.compro||0,noCompro:entry.noCompro||0,noTengo:entry.noTengo||0}
    })

    // Por semana (últimas 4)
    const mesData = ['S1','S2','S3','S4'].map((t,wi)=>{
      const daysInWeek=Array.from({length:7},(_,di)=>{
        const d=getNow(); d.setDate(d.getDate()-(27-wi*7-di))
        return d.toISOString().slice(0,10)
      })
      const entries=daysInWeek.map(str=>str===hoy?actual:hist.find(x=>x.fecha===str)||{compro:0,noCompro:0,noTengo:0})
      return {t,compro:entries.reduce((a,b)=>a+(b.compro||0),0),noCompro:entries.reduce((a,b)=>a+(b.noCompro||0),0),noTengo:entries.reduce((a,b)=>a+(b.noTengo||0),0)}
    })

    return {horaData,semanaData,mesData}
  } catch {
    return { horaData:[], semanaData:[], mesData:[] }
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

  const caudalReal  = loadCaudalData()
  const caudalData  = caudalPeriod==="hora"?caudalReal.horaData:caudalPeriod==="dia"?caudalReal.semanaData:caudalReal.mesData

  const tooltipStyle = {
    contentStyle: {
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      fontSize: 12,
      color: C.text,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    },
    itemStyle: { color: C.text, fontSize: 12 },
    labelStyle: { color: C.white, fontWeight: 700, marginBottom: 4 },
    formatter: v => [fmt(v)]
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
              <Tooltip
                contentStyle={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: C.text,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}
                itemStyle={{ color: C.text }}
                labelStyle={{ color: C.white, fontWeight: 700 }}
                formatter={(v, name) => {
                  const tot = catPie.reduce((a, b) => a + b.value, 0)
                  const pct = tot > 0 ? ((v / tot) * 100).toFixed(1) : 0
                  return [`${fmt(v)} (${pct}%)`, name]
                }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11,color:C.muted}}/>
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
              <Tooltip {...tooltipStyle}/>
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
            <Tooltip {...tooltipStyle} formatter={(val, name)=>[val, name]}/>
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
