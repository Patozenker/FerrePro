import React from 'react'
import { X } from 'lucide-react'
import { useTheme } from '../ThemeContext'

export function Modal({ title, onClose, children, width = 500 }) {
  const { C, s } = useTheme()
  return (
    <div style={s.modal} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:28, width, maxWidth:"96vw", maxHeight:"92vh", overflow:"auto" }}
           onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:C.white }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer" }}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FF({ label, children }) {
  const { s } = useTheme()
  return <div style={{ marginBottom:14 }}><label style={s.label}>{label}</label>{children}</div>
}

export function StockBadge({ stock, min }) {
  const { s, C } = useTheme()
  if (stock === 0)  return <span style={s.badge(C.red)}>Sin stock</span>
  if (stock <= min) return <span style={s.badge(C.yellow)}>Bajo</span>
  return <span style={s.badge(C.green)}>OK</span>
}

export function TR({ children, onClick, style }) {
  const { C } = useTheme()
  return (
    <tr onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", ...style }}
        onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
        onMouseLeave={e => e.currentTarget.style.background = ""}>
      {children}
    </tr>
  )
}

export function Tabs({ tabs, active, onChange }) {
  const { s } = useTheme()
  return (
    <div style={{ display:"flex", gap:2, background:"transparent", borderRadius:8, marginBottom:20, flexWrap:"wrap" }}>
      {tabs.map(t => <button key={t.id} onClick={() => onChange(t.id)} style={s.tab(active === t.id)}>{t.label}</button>)}
    </div>
  )
}

export function PeriodFilter({ value, onChange }) {
  const { s } = useTheme()
  const opts = [{ id:"dia", label:"Hoy" }, { id:"semana", label:"Semana" }, { id:"mes", label:"Mes" }, { id:"anio", label:"Año" }]
  return (
    <div style={{ display:"flex", gap:6 }}>
      {opts.map(o => <button key={o.id} onClick={() => onChange(o.id)} style={{ ...s.pill(value === o.id), fontSize:11, padding:"4px 10px" }}>{o.label}</button>)}
    </div>
  )
}

export function SectionTitle({ children }) {
  const { C } = useTheme()
  return <h3 style={{ margin:"0 0 14px", fontSize:12, fontWeight:700, color:C.subtle, textTransform:"uppercase", letterSpacing:1 }}>{children}</h3>
}
