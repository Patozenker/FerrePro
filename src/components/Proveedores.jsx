import React, { useState, useMemo } from 'react'
import { Search, Plus, Pencil, Trash2, CheckCircle2, Receipt } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt, nextId } from '../utils'
import { Modal, FF, TR } from './Shared'
import ProveedorDetail from './ProveedorDetail'

export default function Proveedores({ proveedores, setProveedores, productos, setProductos, pedidos, setPedidos, pagos, setPagos, historialPrecios, setHistorialPrecios, descuentos, setDescuentos, cotizacionUSD=1200 }) {
  const { C, s } = useTheme()
  const [search, setSearch]           = useState("")
  const [modal, setModal]             = useState(null)
  const [form, setForm]               = useState({})
  const [detailModal, setDetailModal] = useState(null)

  const filtered = useMemo(() => proveedores.filter(p=>p.nombre.toLowerCase().includes(search.toLowerCase())), [proveedores, search])

  const save = () => {
    if (!form.nombre) return
    if (modal.mode==="add") setProveedores(p=>[...p,{...form,id:nextId(p)}])
    else setProveedores(p=>p.map(x=>x.id===modal.item.id?{...x,...form}:x))
    setModal(null)
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.white }}>Proveedores</h1>
          <p style={{ margin:"4px 0 0", fontSize:13, color:C.muted }}>{proveedores.length} proveedores</p>
        </div>
        <button style={s.btn()} onClick={()=>{setForm({nombre:"",contacto:"",tel:"",email:"",cat:"Multi-rubro",ciudad:""});setModal({mode:"add"})}}>
          <Plus size={15}/> Nuevo
        </button>
      </div>

      <div style={{ position:"relative", maxWidth:300, marginBottom:16 }}>
        <Search size={14} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.muted }}/>
        <input style={{ ...s.input,paddingLeft:32 }} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{["Proveedor","Contacto","Email","Cat.","Ciudad","Saldo",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(p=>{
              // Deuda = solo OPs recibidas/revisadas (no las pendientes/en tránsito)
              const pedsRecibidos = pedidos.filter(x=>x.proveedorId===p.id && x.estado==="recibido")
              const totalComp = pedsRecibidos.reduce((a,b)=>a+b.total,0)
              const tp=pagos.filter(x=>x.provId===p.id).reduce((a,b)=>a+b.monto,0)
              const saldo = Math.max(0, totalComp - tp)
              const pedsPend = pedidos.filter(x=>x.proveedorId===p.id && (x.estado==="pendiente"||x.estado==="enviado"||x.estado==="en_tránsito")).length
              const dc=descuentos.filter(d=>d.provId===p.id&&d.activo).length
              return (
                <TR key={p.id}>
                  <td style={{ ...s.td,fontWeight:600 }}>
                    <div onClick={()=>setDetailModal(p)} style={{ color:C.accent,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted" }}>{p.nombre}</div>
                    {dc>0&&<div style={{ fontSize:10,color:C.green,marginTop:2 }}>{dc} desc. activo{dc>1?"s":""}</div>}
                  </td>
                  <td style={s.td}>{p.contacto}</td>
                  <td style={{ ...s.td,color:C.muted,fontSize:12 }}>{p.email}</td>
                  <td style={s.td}><span style={s.badge(C.blue)}>{p.cat}</span></td>
                  <td style={s.td}>{p.ciudad}</td>
                  <td style={{ ...s.td,fontFamily:"monospace",fontWeight:600,fontSize:12 }}>
                    <div style={{ color:saldo>0?C.red:C.green,fontWeight:700 }}>{saldo>0?`Debe ${fmt(saldo)}`:"Al día"}</div>
                    {pedsPend>0&&<div style={{ fontSize:10,color:C.yellow,marginTop:2 }}>⏸ {pedsPend} OP en curso (deuda pausada)</div>}
                  </td>
                  <td style={s.td}>
                    <div style={{ display:"flex",gap:6 }}>
                      <button onClick={()=>setDetailModal(p)} style={{ ...s.btn("purple"),padding:"4px 10px",fontSize:11 }}><Receipt size={12}/> Historial</button>
                      <button onClick={()=>{setForm({...p});setModal({mode:"edit",item:p})}} style={{ background:"none",border:"none",color:C.subtle,cursor:"pointer",padding:4 }}><Pencil size={13}/></button>
                      <button onClick={()=>{if(confirm("¿Eliminar?"))setProveedores(prev=>prev.filter(x=>x.id!==p.id))}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",padding:4,opacity:0.6 }}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </TR>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode==="add"?"Nuevo Proveedor":"Editar Proveedor"} onClose={()=>setModal(null)}>
          <FF label="Nombre / Razón Social"><input style={s.input} value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></FF>
          <div style={s.grid(2)}>
            <FF label="Contacto"><input style={s.input} value={form.contacto||""} onChange={e=>setForm(f=>({...f,contacto:e.target.value}))}/></FF>
            <FF label="Teléfono"><input style={s.input} value={form.tel||""} onChange={e=>setForm(f=>({...f,tel:e.target.value}))} placeholder="5491155..."/></FF>
          </div>
          <FF label="Email"><input style={s.input} type="email" value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></FF>
          <div style={s.grid(2)}>
            <FF label="Categoría"><input style={s.input} value={form.cat||""} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}/></FF>
            <FF label="Ciudad"><input style={s.input} value={form.ciudad||""} onChange={e=>setForm(f=>({...f,ciudad:e.target.value}))}/></FF>
          </div>
          <div style={s.grid(2)}>
            <FF label="Plazo de pago (días)">
              <select style={s.input} value={form.plazo||30} onChange={e=>setForm(f=>({...f,plazo:+e.target.value}))}>
                {[7,15,30,45,60,90].map(d=><option key={d} value={d}>{d} días</option>)}
              </select>
            </FF>
            <FF label="Forma de pago predeterminada">
              <select style={s.input} value={form.formaPagoDefault||'transferencia'} onChange={e=>setForm(f=>({...f,formaPagoDefault:e.target.value}))}>
                {['transferencia','cheque','efectivo','tarjeta','débito'].map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </FF>
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:8 }}>
            <button style={s.btn("ghost")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={s.btn()} onClick={save}><CheckCircle2 size={14}/> Guardar</button>
          </div>
        </Modal>
      )}

      {detailModal && <ProveedorDetail prov={detailModal} productos={productos} setProductos={setProductos} pedidos={pedidos} setPedidos={setPedidos} pagos={pagos} setPagos={setPagos} historialPrecios={historialPrecios} setHistorialPrecios={setHistorialPrecios} descuentos={descuentos} setDescuentos={setDescuentos} onClose={()=>setDetailModal(null)} cotizacionUSD={cotizacionUSD}/>}
    </div>
  )
}
