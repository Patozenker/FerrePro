import React, { useState } from 'react'
import { useTheme } from '../ThemeContext'
import { fmt, fmtDate, today, nextId } from '../utils'
import { CheckCircle2, X } from 'lucide-react'

export default function NotaCredito({ venta, cliente, productos, onClose, onConfirm }) {
  const { C, s } = useTheme()

  // Each item: selected, qty returned
  const [items, setItems] = useState(
    venta.items.map(it => ({
      ...it,
      returnQty: 0,
      returnCheck: false,
    }))
  )
  const [motivo, setMotivo] = useState('Devolución de mercadería')
  const [resolucion, setResolucion] = useState('saldo')  // 'saldo' | 'devolucion'

  const totalNC = items.reduce((sum, it) => {
    if (!it.returnCheck || !it.returnQty) return sum
    const sub = it.precio * it.returnQty * (1 - (it.descuento || 0) / 100)
    return sum + sub
  }, 0)

  const anySelected = items.some(it => it.returnCheck && it.returnQty > 0)

  const confirmar = () => {
    if (!anySelected) return
    const itemsDevueltos = items.filter(it => it.returnCheck && it.returnQty > 0).map(it => ({
      prodId: it.prodId,
      nombre: it.nombre || productos.find(p => p.id === it.prodId)?.nombre || '',
      qty: it.returnQty,
      precio: it.precio,
      subtotal: it.precio * it.returnQty * (1 - (it.descuento || 0) / 100),
    }))
    onConfirm({ itemsDevueltos, totalNC, motivo, resolucion })
    onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400 }} onClick={onClose}>
      <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:580,maxWidth:'95vw',maxHeight:'92vh',overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:800,color:C.white,fontSize:17 }}>📋 Nota de Crédito</div>
            <div style={{ fontSize:12,color:C.muted,marginTop:2 }}>
              Factura #{String(venta.id).padStart(4,'0')} · {fmtDate(venta.fecha)} · {cliente?.nombre||'—'}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:20 }}>✕</button>
        </div>

        {/* Items de la factura original */}
        <div style={{ fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8 }}>
          Seleccioná los productos a devolver
        </div>
        <div style={{ border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden',marginBottom:16 }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:C.surface }}>
                {['','Producto','Facturado','Cant. a devolver','Subtotal NC'].map(h => (
                  <th key={h} style={{ ...s.th,padding:'8px 10px',textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const prod = productos.find(p => p.id === it.prodId)
                const subNC = it.returnCheck && it.returnQty ? it.precio * it.returnQty * (1 - (it.descuento||0)/100) : 0
                return (
                  <tr key={it.prodId} style={{ borderTop:`1px solid ${C.border}`, background: it.returnCheck ? `${C.green}08` : '' }}>
                    <td style={{ padding:'8px 10px',textAlign:'center' }}>
                      <input type="checkbox" checked={it.returnCheck}
                        style={{ width:15,height:15,cursor:'pointer',accentColor:C.accent }}
                        onChange={e => setItems(prev => prev.map((x,i) => i===idx
                          ? {...x, returnCheck:e.target.checked, returnQty: e.target.checked ? x.qty : 0}
                          : x))}/>
                    </td>
                    <td style={{ ...s.td,fontWeight:500,color:C.white,padding:'8px 10px' }}>
                      {prod?.nombre||`#${it.prodId}`}
                    </td>
                    <td style={{ ...s.td,fontFamily:'monospace',padding:'8px 10px' }}>
                      {it.qty} × {fmt(it.precio)}
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <input type="number" min={0} max={it.qty} disabled={!it.returnCheck}
                        value={it.returnCheck ? it.returnQty : ''}
                        onChange={e => setItems(prev => prev.map((x,i) => i===idx
                          ? {...x, returnQty: Math.min(it.qty, Math.max(0, +e.target.value||0))}
                          : x))}
                        style={{ ...s.input, width:72, padding:'4px 8px', fontFamily:'monospace',
                          opacity: it.returnCheck ? 1 : 0.4,
                          borderColor: it.returnCheck ? (it.returnQty>0?C.green:C.yellow) : C.border }}/>
                    </td>
                    <td style={{ ...s.td,fontFamily:'monospace',fontWeight:700,color:subNC>0?C.green:C.muted,padding:'8px 10px' }}>
                      {subNC > 0 ? fmt(subNC) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Total NC */}
        {totalNC > 0 && (
          <div style={{ display:'flex',justifyContent:'flex-end',padding:'10px 14px',background:`${C.green}12`,borderRadius:8,marginBottom:16,border:`1px solid ${C.green}30` }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11,color:C.muted }}>Total Nota de Crédito</div>
              <div style={{ fontFamily:'monospace',fontSize:22,fontWeight:800,color:C.green }}>{fmt(totalNC)}</div>
            </div>
          </div>
        )}

        {/* Motivo */}
        <div style={{ marginBottom:12 }}>
          <label style={s.label}>Motivo de devolución</label>
          <input style={s.input} value={motivo} onChange={e=>setMotivo(e.target.value)}
            placeholder="Devolución de mercadería, producto defectuoso..."/>
        </div>

        {/* Resolución */}
        <div style={{ marginBottom:18 }}>
          <label style={s.label}>¿Cómo se resuelve?</label>
          <div style={{ display:'flex',gap:8 }}>
            {[
              { id:'saldo', label:'💳 Acreditar en cuenta', desc:'El monto queda como saldo a favor del cliente' },
              { id:'devolucion', label:'💵 Devolver dinero', desc:'Se devuelve el efectivo / transferencia al cliente' },
            ].map(opt => (
              <div key={opt.id} onClick={() => setResolucion(opt.id)}
                style={{ flex:1,padding:'10px 14px',borderRadius:10,cursor:'pointer',
                  border:`2px solid ${resolucion===opt.id?C.accent:C.border}`,
                  background: resolucion===opt.id ? C.accentDim : C.surface }}>
                <div style={{ fontWeight:700,color:resolucion===opt.id?C.accent:C.white,fontSize:13 }}>{opt.label}</div>
                <div style={{ fontSize:11,color:C.muted,marginTop:3 }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <button style={s.btn('ghost')} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btn(), opacity: anySelected ? 1 : 0.4 }}
            disabled={!anySelected} onClick={confirmar}>
            <CheckCircle2 size={14}/> Emitir Nota de Crédito
          </button>
        </div>
      </div>
    </div>
  )
}
