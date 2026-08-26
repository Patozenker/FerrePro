import React, { useState, useMemo, useRef } from 'react'
import { Search, Plus, X, CheckCircle2, Eye, FileText, ShoppingBag, MessageCircle, Mail, Copy, Image as ImageIcon, LayoutGrid, List } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { fmt, fmtDate, today, getNow, nextId } from '../utils'
import { TR, Modal } from './Shared'

const FORMAS_PAGO = ["Efectivo","Transferencia","QR","Tarjeta","Cuenta Cte."]

// ── clave compartida con Dashboard ──────────────────────────────────────────
const CONT_KEY  = 'ferreteria_contadores'
const HIST_KEY  = 'ferreteria_contadores_hist'
// HOY_STR ahora usa today() de utils — respeta el override de fecha test
const HOY_STR   = () => today()

function loadCont() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONT_KEY)||'null')
    if (!raw || raw.fecha !== HOY_STR()) {
      // guardar en historial antes de resetear
      if (raw && raw.fecha) {
        const hist = JSON.parse(localStorage.getItem(HIST_KEY)||'[]')
        hist.push({ fecha:raw.fecha, compro:raw.compro||0, noCompro:raw.noCompro||0, noTengo:raw.noTengo||0 })
        localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-60))) // máx 60 días
      }
      return { compro:0, noCompro:0, noTengo:0, fecha:HOY_STR() }
    }
    return raw
  } catch { return { compro:0, noCompro:0, noTengo:0, fecha:HOY_STR() } }
}
function saveCont(c) { try { localStorage.setItem(CONT_KEY, JSON.stringify({...c, fecha:HOY_STR()})) } catch {} }

const CONT_HORA_KEY = 'ferreteria_contadores_hora'
function saveContHora(key) {
  try {
    const hoy = HOY_STR()
    const hr  = getNow().getHours()
    // franja: e.g. "18-19"
    const franja = `${hr}-${hr+1}`
    const raw = JSON.parse(localStorage.getItem(CONT_HORA_KEY)||'null')
    const franjas = (raw && raw.fecha===hoy) ? {...raw.franjas} : {}
    const prev = franjas[franja] || {compro:0,noCompro:0,noTengo:0}
    franjas[franja] = {...prev, [key]:(prev[key]||0)+1}
    localStorage.setItem(CONT_HORA_KEY, JSON.stringify({fecha:hoy, franjas}))
  } catch {}
}

// ── helpers de factura ───────────────────────────────────────────────────────
function buildMsgFactura(venta, cliente, productosMap) {
  const num = String(venta.id).padStart(4,'0')
  const lines = venta.items.map(it => {
    const p = productosMap[it.prodId]
    const sub = it.precio * it.qty * (1-(it.descuento||0)/100)
    return `• ${p?.nombre||'Prod'} x${it.qty} = ${fmt(sub)}`
  })
  const tipoLabel = venta.tipo==='presupuesto' ? '📋 *Presupuesto' : venta.tipo==='remito' ? '📦 *Remito' : '🧾 *Factura'
  return `${tipoLabel} #${num}* — ${fmtDate(venta.fecha)}\n`
    + `Cliente: ${cliente?.nombre||'Consumidor Final'}\n`
    + `Pago: ${venta.formaPago||'—'}\n\n`
    + lines.join('\n')
    + `\n\n*Total: ${fmt(venta.total)}*\n\nGracias por su compra! 🔧`
}

// ── Modal detalle de documento ───────────────────────────────────────────────
function DocModal({ venta, clientes, productos, onClose, onConvertir, configAdmin={} }) {
  const { C, s } = useTheme()
  const cl = clientes.find(c=>c.id===venta.clienteId)
  const esPres  = venta.tipo==='presupuesto'
  const esRemito= venta.tipo==='remito'
  const tipoStr = esPres ? 'Presupuesto' : esRemito ? 'Remito' : 'Factura'
  const prodMap = Object.fromEntries(productos.map(p=>[p.id,p]))
  const msg = buildMsgFactura(venta, cl, prodMap)
  return (
    <Modal title={`${tipoStr} #${String(venta.id).padStart(4,'0')}`} onClose={onClose} width={560}>
        {(configAdmin.nombreLocal || configAdmin.cuit) && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0 12px',borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
            <img src={configAdmin.logoCustom||'/logo.png'} alt="" style={{width:36,height:36,objectFit:'contain',borderRadius:6}} onError={e=>e.target.style.display='none'}/>
            <div style={{fontSize:12,lineHeight:1.6}}>
              <div style={{fontWeight:700,color:C.white,fontSize:14}}>{configAdmin.nombreLocal||'Ferretería'}</div>
              {configAdmin.cuit && <div style={{color:C.muted}}>CUIT: {configAdmin.cuit} · {configAdmin.condIva||''}</div>}
              {configAdmin.domicilio && <div style={{color:C.muted}}>{configAdmin.domicilio}</div>}
              {configAdmin.telLocal && <div style={{color:C.muted}}>Tel: {configAdmin.telLocal}</div>}
            </div>
          </div>
        )}

      <div>
        <div style={{marginBottom:14}}>
          {[
            {label:'Cliente',       val:cl?.nombre||'—'},
            {label:'Fecha',         val:fmtDate(venta.fecha)},
            {label:'Forma de pago', val:venta.formaPago||'—'},
            {label:'Nota',          val:venta.nota||'—'},
            {label:'Estado',        val:<span style={s.badge(venta.estado==='completada'?C.green:C.blue)}>{venta.estado}</span>},
          ].map(r=>(
            <div key={r.label} style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
              <span style={{color:C.muted,fontSize:13}}>{r.label}</span>
              <span style={{fontWeight:500,fontSize:13}}>{r.val}</span>
            </div>
          ))}
        </div>
        <table style={s.table}>
          <thead><tr>{['Producto','Precio','Qty','Desc%','Subtotal'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {venta.items.map((it,i)=>{
              const p=productos.find(x=>x.id===it.prodId)
              const desc=it.descuento||0, sub=it.precio*it.qty*(1-desc/100)
              return <tr key={i}>
                <td style={s.td}>{p?.nombre||`#${it.prodId}`}</td>
                <td style={{...s.td,fontFamily:'monospace'}}>{fmt(it.precio)}</td>
                <td style={{...s.td,fontFamily:'monospace',fontWeight:700}}>×{it.qty}</td>
                <td style={{...s.td,fontFamily:'monospace',color:desc>0?C.yellow:C.muted}}>{desc>0?`${desc}%`:'—'}</td>
                <td style={{...s.td,fontFamily:'monospace',color:C.accent,fontWeight:700}}>{fmt(sub)}</td>
              </tr>
            })}
          </tbody>
        </table>
        <div style={{borderTop:`2px solid ${C.border}`,marginTop:4,paddingTop:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
            <div style={{fontSize:11,color:C.muted}}>
              <div>Subtotal s/IVA: <span style={{fontFamily:'monospace',color:C.subtle}}>{fmt(Math.round(venta.total/1.21))}</span></div>
              <div>IVA 21%: <span style={{fontFamily:'monospace',color:C.subtle}}>{fmt(Math.round(venta.total-venta.total/1.21))}</span></div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,color:C.muted}}>Total c/IVA</div>
              <div style={{fontFamily:'monospace',fontSize:26,fontWeight:800,color:C.accent}}>{fmt(venta.total)}</div>
            </div>
          </div>
        </div>
        {/* Acciones */}
        <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
          {!esPres && (
            <button
              style={{...s.btn('ghost'),padding:'6px 12px',fontSize:12,border:`1px solid ${C.border}`}}
              onClick={()=>{
                // Generar remito desde factura
                const remito = {...venta, id: Date.now(), tipo:'remito', estado:'remito', formaPago:null, ventaOrigen: venta.id}
                if(window.onGenerarRemito) window.onGenerarRemito(remito)
                else alert('Función disponible en próxima versión')
              }}>
              📋 Generar remito
            </button>
          )}
          {cl?.tel && (
            <a href={`https://wa.me/${(cl.tel||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`}
              target="_blank" rel="noreferrer"
              style={{...s.btn('green'),textDecoration:'none',padding:'6px 12px',fontSize:12}}>
              <MessageCircle size={13}/> WhatsApp
            </a>
          )}
          {cl?.email && (
            <a href={`mailto:${cl.email}?subject=${tipoStr}%20%23${String(venta.id).padStart(4,'0')}&body=${encodeURIComponent(msg)}`}
              style={{...s.btn('blue'),textDecoration:'none',padding:'6px 12px',fontSize:12}}>
              <Mail size={13}/> Email
            </a>
          )}
          <button onClick={()=>navigator.clipboard?.writeText(msg)} style={{...s.btn('ghost'),padding:'6px 12px',fontSize:12}}>
            <Copy size={13}/> Copiar
          </button>
          {esPres && onConvertir && (
            <button style={s.btn()} onClick={()=>{onConvertir(venta);onClose()}}>
              <FileText size={14}/> Convertir a Factura
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Modal de cobro ───────────────────────────────────────────────────────────
function PagoModal({ total, onConfirm, onClose, configAdmin={} }) {
  const { C, s } = useTheme()
  const [forma, setForma] = useState('Efectivo')
  const [nota, setNota]   = useState('')
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:150}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:400,maxWidth:'95vw'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Registrar cobro</div>
        <div style={{fontFamily:'monospace',fontSize:28,fontWeight:800,color:C.accent,marginBottom:18}}>{fmt(total)}</div>
        <div style={{marginBottom:14}}>
          <label style={s.label}>Forma de pago</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {FORMAS_PAGO.map(f=><button key={f} onClick={()=>setForma(f)} style={{...s.pill(forma===f),fontSize:12}}>{f}</button>)}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={s.label}>Nota (opcional)</label>
          <input style={s.input} placeholder="Seña, factura #0012, etc..." value={nota} onChange={e=>setNota(e.target.value)}/>
        </div>
        {/* Links QR / transferencia */}
        {(configAdmin.mpLink || configAdmin.modoLink || configAdmin.alias || configAdmin.otroLink) && (
          <div style={{marginBottom:14,padding:'10px 12px',background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>QR / Transferencia</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {configAdmin.mpLink && (
                <a href={configAdmin.mpLink} target="_blank" rel="noreferrer"
                  style={{...s.btn(),textDecoration:'none',fontSize:11,padding:'5px 10px',background:'#009ee3',border:'none'}}>
                  💙 Mercado Pago
                </a>
              )}
              {configAdmin.modoLink && (
                <a href={configAdmin.modoLink} target="_blank" rel="noreferrer"
                  style={{...s.btn(),textDecoration:'none',fontSize:11,padding:'5px 10px',background:'#ff6900',border:'none'}}>
                  🔶 MODO
                </a>
              )}
              {configAdmin.otroLink && (
                <a href={configAdmin.otroLink} target="_blank" rel="noreferrer"
                  style={{...s.btn('ghost'),textDecoration:'none',fontSize:11,padding:'5px 10px'}}>
                  💳 {configAdmin.otroNombre||'Otro'}
                </a>
              )}
              {configAdmin.alias && (
                <span style={{fontSize:11,color:C.muted}}>Alias: <strong style={{color:C.white}}>{configAdmin.alias}</strong></span>
              )}
            </div>
          </div>
        )}
        <div style={{display:'flex',gap:10}}>
          <button style={{...s.btn('ghost'),flex:1,justifyContent:'center'}} onClick={onClose}>Cancelar</button>
          <button style={{...s.btn(),flex:1,justifyContent:'center'}} onClick={()=>onConfirm(forma,nota)}>
            <CheckCircle2 size={15}/> Confirmar cobro
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal post-venta: enviar factura ─────────────────────────────────────────
function EnviarFacturaModal({ venta, cliente, productosMap, onClose }) {
  const { C, s } = useTheme()
  const msg = buildMsgFactura(venta, cliente, productosMap)
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard?.writeText(msg); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:420,maxWidth:'95vw'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:4}}>
          ✅ Venta registrada — Factura #{String(venta.id).padStart(4,'0')}
        </div>
        <div style={{fontSize:13,color:C.muted,marginBottom:18}}>¿Enviás comprobante al cliente?</div>
        <pre style={{background:C.surface,borderRadius:8,padding:12,fontSize:11,color:C.subtle,whiteSpace:'pre-wrap',marginBottom:16,maxHeight:160,overflowY:'auto',lineHeight:1.6}}>
          {msg}
        </pre>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {cliente?.tel && (
            <a href={`https://wa.me/${(cliente.tel||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`}
              target="_blank" rel="noreferrer" onClick={onClose}
              style={{...s.btn('green'),textDecoration:'none',flex:1,justifyContent:'center'}}>
              <MessageCircle size={14}/> WhatsApp
            </a>
          )}
          {cliente?.email && (
            <a href={`mailto:${cliente.email}?subject=Factura%20%23${String(venta.id).padStart(4,'0')}&body=${encodeURIComponent(msg)}`}
              onClick={onClose}
              style={{...s.btn('blue'),textDecoration:'none',flex:1,justifyContent:'center'}}>
              <Mail size={14}/> Email
            </a>
          )}
          <button onClick={copy} style={{...s.btn('ghost'),flex:1,justifyContent:'center'}}>
            <Copy size={13}/> {copied?'¡Copiado!':'Copiar'}
          </button>
        </div>
        <button onClick={onClose} style={{...s.btn('ghost'),width:'100%',justifyContent:'center',marginTop:10,fontSize:12}}>
          Cerrar sin enviar
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────


export default function Ventas({ ventas, setVentas, productos, setProductos, clientes, setClientes, allCats, configAdmin={}, cotizacionUSD=1200, historialPrecios=[] }) {
  const { C, s } = useTheme()
  const [tab, setTab]             = useState('nueva')
  const [clienteId, setClienteId] = useState('0')
  const [clientePct, setClientePct] = useState(0)
  const [items, setItems]         = useState([])
  const [prodSearch, setProdSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('Todos')
  const [tipoDoc, setTipoDoc]     = useState('venta')
  const [showPago, setShowPago]   = useState(false)
  const [searchHist, setSearchHist] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [docAbierto, setDocAbierto] = useState(null)
  const [showDrop, setShowDrop]   = useState(false)
  const [galeriaVisible, setGaleriaVisible] = useState(false)
  const [ventaEmitida, setVentaEmitida] = useState(null) // para modal post-venta

  // Contadores — mismo formato que Dashboard para sincronía
  const [cont, setCont] = useState(loadCont)
  const incCont = key => setCont(prev => { const n={...prev,[key]:(prev[key]||0)+1,fecha:HOY_STR()}; saveCont(n); saveContHora(key); return n })
  const decCont = key => setCont(prev => { const n={...prev,[key]:Math.max(0,(prev[key]||0)-1),fecha:HOY_STR()}; saveCont(n); return n })
  const resetCont = () => { const n={compro:0,noCompro:0,noTengo:0,fecha:HOY_STR()}; setCont(n); saveCont(n) }

  const cats = allCats||['Herramientas','Fijaciones','Pinturas','Electricidad','Plomería','Madera','Adhesivos']

  // Costo de referencia: usa el más reciente agregado del historial
  const getLatestCosto = (prodId, fallback, moneda='ARS') => {
    const entries = historialPrecios.filter(h=>h.prodId===prodId).sort((a,b)=>b.id - a.id)
    if (!entries.length) return fallback
    const h = entries[0]
    return (h.moneda||moneda) === 'USD' ? Math.round(h.precio * cotizacionUSD) : h.precio
  }

  const clientesOrdenados = useMemo(()=>{
    const counts={}
    ventas.forEach(v=>{counts[v.clienteId]=(counts[v.clienteId]||0)+1})
    return [...clientes].sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0))
  },[clientes,ventas])

  // Top 10 más vendidos, filtrado por categoría si está activa
  const topProds = useMemo(()=>{
    const counts={}
    ventas.filter(v=>v.tipo!=='presupuesto').forEach(v=>v.items.forEach(i=>{counts[i.prodId]=(counts[i.prodId]||0)+i.qty}))
    const ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1])
      .map(([id])=>productos.find(p=>p.id===+id)).filter(Boolean).filter(p=>p.stock>0)
    // si hay historial, usarlo; si no, mostrar todos con stock
    const base = ranked.length>0 ? ranked : productos.filter(p=>p.stock>0)
    // aplicar filtro de categoría
    return (catFiltro==='Todos' ? base : base.filter(p=>p.cat===catFiltro)).slice(0,10)
  },[ventas,productos,catFiltro])

  const disponibles = useMemo(()=>
    productos.filter(p=>{
      const matchCat  = catFiltro==='Todos'||p.cat===catFiltro
      const matchSrch = !prodSearch||p.nombre.toLowerCase().includes(prodSearch.toLowerCase())||(p.sku||'').toLowerCase().includes(prodSearch.toLowerCase())
      return p.stock>0 && matchCat && matchSrch
    }),[productos,catFiltro,prodSearch])

  const total = items.reduce((a,b)=>a+b.subtotal,0)
  const prodMap = useMemo(()=>Object.fromEntries(productos.map(p=>[p.id,p])),[productos])

  const handleClienteChange = id => {
    setClienteId(id)
    const cl = clientes.find(c=>c.id===+id)
    const pct = cl?.pctGanancia||0
    setClientePct(pct)
    if (pct>0) {
      setItems(prev=>prev.map(i=>{
        const p=productos.find(x=>x.id===i.prodId); if(!p) return i
        const precio=Math.round(p.costo*(1+pct/100))
        return {...i,precioTipo:'pct',pct,precio,subtotal:precio*i.qty*(1-(i.descuento||0)/100)}
      }))
    }
  }

  const addItemDirect = prod => {
    if (!prod) return
    setItems(prev=>{
      const ex=prev.find(i=>i.prodId===prod.id)
      if (ex) return prev.map(i=>i.prodId===prod.id
        ? {...i,qty:i.qty+1,subtotal:(i.qty+1)*i.precio*(1-(i.descuento||0)/100)}
        : i)
      // Calcular precio usando historial + margen guardado en el producto
      const histEntries = historialPrecios.filter(h=>h.prodId===prod.id).sort((a,b)=>b.id - a.id)
      const hist = histEntries[0]
      const baseCosto  = hist ? hist.precio : prod.costo
      const baseMoneda = hist ? (hist.moneda||'ARS') : (prod.moneda||'ARS')
      const costoARS   = baseMoneda==='USD' ? Math.round(baseCosto*cotizacionUSD) : baseCosto
      const pct = clientePct || 0
      const precioTipo = pct > 0 ? 'pct' : 'lista'
      // Si el cliente tiene descuento por %, aplicarlo; sino usar margen del producto
      const margenProd = prod.margen || 0
      const precio = pct > 0
        ? Math.round(costoARS * (1 + pct / 100))
        : (margenProd > 0 ? Math.round(costoARS * (1 + margenProd / 100)) : prod.venta)
      return [...prev, { prodId:prod.id, nombre:prod.nombre, costo:costoARS, qty:1, precio, precioTipo, pct, descuento:0, subtotal:precio }]
    })
    setProdSearch(''); setShowDrop(false)
  }

  // FIX: usar idx como identificador para evitar colisiones si prodId no es único
  const updateItem = (idx, field, val) => {
    setItems(prev=>prev.map((item,i)=>{
      if (i!==idx) return item
      let ni = {...item}
      if (field==='precioTipo') {
        ni.precioTipo=val
        const prod=prodMap[item.prodId]
        // Usar item.costo (ya convertido a ARS desde historial en addItemDirect)
        // en vez de prod.costo que puede estar en USD sin convertir
        const costoRef = item.costo || (prod ? Math.round((prod.moneda==='USD'?prod.costo*cotizacionUSD:prod.costo)) : 0)
        if (val==='pct') {
          const pct=ni.pct||clientePct||0
          ni.precio=Math.round(costoRef*(1+pct/100))
          ni.pct=pct
        } else {
          // Para 'lista': recalcular con margen guardado si existe, sino usar prod.venta
          ni.precio=prod?(prod.margen>0?Math.round(costoRef*(1+prod.margen/100)):prod.venta):ni.precio
        }
      } else if (field==='pct') {
        ni.pct=+val
        const prod=prodMap[item.prodId]
        const costoRef = item.costo || (prod ? Math.round((prod.moneda==='USD'?prod.costo*cotizacionUSD:prod.costo)) : 0)
        ni.precio=Math.round(costoRef*(1+(+val)/100))
        ni.precioTipo='pct'
      } else if (field==='precio') {
        ni.precio=+val||0
      } else if (field==='qty') {
        ni.qty=Math.max(1,+val||1)
      } else if (field==='descuento') {
        ni.descuento=Math.min(100,Math.max(0,+val||0))
      }
      ni.subtotal=ni.precio*ni.qty*(1-(ni.descuento||0)/100)
      return ni
    }))
  }

  const finalizar = () => {
    if (!items.length) return
    if (tipoDoc==='presupuesto' || tipoDoc==='remito') {
      const doc={id:nextId(ventas),fecha:today(),clienteId:+clienteId,
        items:items.map(i=>({prodId:i.prodId,qty:i.qty,precio:i.precio,descuento:i.descuento||0})),
        total,tipo:tipoDoc,estado:tipoDoc,formaPago:null,nota:''}
      setVentas(prev=>[...prev,doc])
      setItems([]); setProdSearch(''); setClienteId('0')
    } else {
      setShowPago(true)
    }
  }

  const confirmarCobro = (forma, nota) => {
    const doc={id:nextId(ventas),fecha:today(),hora:String(new Date().getHours()),
      clienteId:+clienteId,
      items:items.map(i=>({prodId:i.prodId,qty:i.qty,precio:i.precio,descuento:i.descuento||0})),
      total,tipo:'venta',estado:'completada',formaPago:forma,nota}
    setVentas(prev=>[...prev,doc])
    setProductos(prev=>prev.map(p=>{const it=items.find(i=>i.prodId===p.id); return it?{...p,stock:Math.max(0,p.stock-it.qty)}:p}))
    setClientes(prev=>prev.map(c=>c.id===+clienteId?{...c,compras:(c.compras||0)+1}:c))
    // Auto-incrementar "Compró" — sincronizado con Dashboard
    incCont('compro')
    setShowPago(false)
    setVentaEmitida(doc)  // mostrar modal de envío
    setItems([]); setProdSearch(''); setClienteId('0')
  }

  const [presAConvertir, setPresAConvertir] = useState(null)
  const convertirAFactura = pres => { setPresAConvertir(pres) }
  const confirmarConversion = (forma, nota) => {
    const pres = presAConvertir
    if (!pres) return
    setVentas(prev=>prev.map(v=>v.id===pres.id?{...v,tipo:'venta',estado:'completada',formaPago:forma,nota:nota||v.nota,hora:String(new Date().getHours())}:v))
    setProductos(prev=>prev.map(p=>{const it=pres.items.find(i=>i.prodId===p.id); return it?{...p,stock:Math.max(0,p.stock-it.qty)}:p}))
    incCont('compro')
    setPresAConvertir(null)
  }

  const filteredHist = useMemo(()=>{
    let res=[...ventas]
    if (filtroTipo!=='todos') res=res.filter(v=>filtroTipo==='presupuesto'?v.tipo==='presupuesto':v.tipo!=='presupuesto')
    if (searchHist) res=res.filter(v=>{const cl=clientes.find(c=>c.id===v.clienteId); return cl?.nombre.toLowerCase().includes(searchHist.toLowerCase())})
    return res.reverse()
  },[ventas,filtroTipo,searchHist,clientes])

  const cobrosHoy = useMemo(()=>{
    const hoy=today(),res={}; FORMAS_PAGO.forEach(f=>{res[f]=0})
    ventas.filter(v=>v.fecha===hoy&&v.estado==='completada'&&v.formaPago).forEach(v=>{res[v.formaPago]=(res[v.formaPago]||0)+v.total})
    return res
  },[ventas])

  const clienteActual = clientes.find(c=>c.id===+clienteId)

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:800,color:C.white}}>Ventas / Caja</h1>
          <p style={{margin:'4px 0 0',fontSize:13,color:C.muted}}>{ventas.filter(v=>v.tipo!=='presupuesto').length} ventas · {ventas.filter(v=>v.tipo==='presupuesto').length} presupuestos</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>

          {[{id:'nueva',label:'Nueva'},{id:'historial',label:'Historial'}].map(t=>(
            <button key={t.id} style={s.btn(tab===t.id?'primary':'ghost')} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab==='nueva' ? (
        <div style={s.grid(2)}>
          {/* Formulario */}
          <div style={s.card}>
            <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
              {[{id:'venta',label:'Venta',ico:'shop'},{id:'presupuesto',label:'Presupuesto',ico:'file'}].map(t=>(
                <button key={t.id} onClick={()=>setTipoDoc(t.id)}
                  style={{...s.btn(tipoDoc===t.id?t.id==='venta'?'primary':'blue':'ghost'),flex:1,justifyContent:'center'}}>
                  {t.ico==='shop'?<ShoppingBag size={12}/>:<FileText size={12}/>} {t.label}
                </button>
              ))}
            </div>

            <div style={{marginBottom:10}}>
              <label style={s.label}>Cliente</label>
              <select style={s.input} value={clienteId} onChange={e=>handleClienteChange(e.target.value)}>
                {clientesOrdenados.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.pctGanancia>0?` (+${c.pctGanancia}%)`:''}{c.compras>0?` (${c.compras}x)`:''}</option>)}
              </select>
            </div>

            <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
              {['Todos',...cats].map(c=>(
                <button key={c} onClick={()=>{setCatFiltro(c);setProdSearch('')}}
                  style={{...s.pill(catFiltro===c),fontSize:10,padding:'2px 7px'}}>
                  {c==='Todos'?'Todos':c.length>5?c.slice(0,5):c}
                </button>
              ))}
            </div>

            <div style={{marginBottom:10,position:'relative'}}>
              <label style={s.label}>Buscar producto</label>
              <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:galeriaVisible?8:0}}>
                <div style={{position:'relative',flex:1}}>
                  <Search size={13} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:C.muted,pointerEvents:'none'}}/>
                  <input style={{...s.input,paddingLeft:28}} placeholder="Nombre o SKU..."
                    value={prodSearch}
                    onChange={e=>{setProdSearch(e.target.value);setShowDrop(true)}}
                    onFocus={()=>setShowDrop(true)}
                    onKeyDown={e=>{if(e.key==='Enter'&&disponibles.length>0){addItemDirect(disponibles[0]);e.preventDefault()}}}
                  />
                </div>
                <button
                  title={galeriaVisible ? 'Ver lista' : 'Ver fotos'}
                  onClick={()=>{setGaleriaVisible(v=>!v);setShowDrop(false)}}
                  style={{...s.btn(galeriaVisible?'primary':'ghost'),padding:'8px 10px',flexShrink:0}}
                >
                  {galeriaVisible ? <List size={15}/> : <LayoutGrid size={15}/>}
                </button>
              </div>

              {/* GALERÍA VISUAL */}
              {galeriaVisible && (
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:10,marginBottom:8}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:8}}>
                    {prodSearch ? `${disponibles.length} resultado(s) para "${prodSearch}"` : `${topProds.length > 0 ? `⭐ Más vendidos — ` : ''}${disponibles.length} con stock`}
                  </div>
                  {!prodSearch && topProds.length>0 && (
                    <>
                      <div style={{fontSize:10,fontWeight:700,color:C.accent,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>⭐ Más vendidos</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(88px,1fr))',gap:8,marginBottom:10}}>
                        {topProds.map(p=>(
                          <div key={`gtop-${p.id}`} onMouseDown={e=>{e.preventDefault();addItemDirect(p)}}
                            title={`${p.nombre} — ${fmt(p.venta)} — Stock: ${p.stock}`}
                            style={{cursor:'pointer',borderRadius:8,border:`2px solid ${C.accent}40`,background:C.card,overflow:'hidden',display:'flex',flexDirection:'column',transition:'border-color 0.15s,box-shadow 0.15s'}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.boxShadow=`0 0 0 2px ${C.accentDim}`}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=`${C.accent}40`;e.currentTarget.style.boxShadow='none'}}>
                            <div style={{width:'100%',paddingTop:'100%',position:'relative',background:C.surface}}>
                              {(p.foto || p.imagen) ? <img src={p.foto || p.imagen} alt={p.nombre} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/> :
                                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                                  <ImageIcon size={20} color={C.border}/><span style={{fontSize:9,color:C.border}}>sin foto</span>
                                </div>}
                              <div style={{position:'absolute',top:3,right:3,background:p.stock<=p.minStock?C.red:C.green,color:'#fff',fontSize:9,fontWeight:800,borderRadius:4,padding:'1px 4px'}}>{p.stock}</div>
                              <div style={{position:'absolute',top:3,left:3,background:C.accent,color:'#fff',fontSize:8,fontWeight:800,borderRadius:4,padding:'1px 4px'}}>★</div>
                            </div>
                            <div style={{padding:'5px 6px'}}>
                              <div style={{fontSize:10,fontWeight:600,color:C.white,lineHeight:1.3,marginBottom:2,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{p.nombre}</div>
                              <div style={{fontSize:10,fontFamily:'monospace',color:C.accent,fontWeight:700}}>{fmt(p.venta)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>📦 Todos ({disponibles.length})</div>
                    </>
                  )}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(88px,1fr))',gap:8,maxHeight:260,overflowY:'auto'}}>
                    {(prodSearch ? disponibles : disponibles).map(p=>(
                      <div
                        key={p.id}
                        onMouseDown={e=>{e.preventDefault();addItemDirect(p)}}
                        title={`${p.nombre} — ${fmt(p.venta)} — Stock: ${p.stock}`}
                        style={{cursor:'pointer',borderRadius:8,border:`1px solid ${C.border}`,background:C.card,overflow:'hidden',display:'flex',flexDirection:'column',transition:'border-color 0.15s,box-shadow 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.boxShadow=`0 0 0 2px ${C.accentDim}`}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none'}}
                      >
                        <div style={{width:'100%',paddingTop:'100%',position:'relative',background:C.surface}}>
                          {(p.foto || p.imagen)
                            ? <img src={p.foto || p.imagen} alt={p.nombre} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                            : <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
                                <ImageIcon size={20} color={C.border}/>
                                <span style={{fontSize:9,color:C.border}}>sin foto</span>
                              </div>
                          }
                          <div style={{position:'absolute',top:3,right:3,background:p.stock<=p.minStock?C.red:C.green,color:'#fff',fontSize:9,fontWeight:800,borderRadius:4,padding:'1px 4px'}}>
                            {p.stock}
                          </div>
                        </div>
                        <div style={{padding:'5px 6px'}}>
                          <div style={{fontSize:10,fontWeight:600,color:C.white,lineHeight:1.3,marginBottom:2,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                            {p.nombre}
                          </div>
                          <div style={{fontSize:10,fontFamily:'monospace',color:C.accent,fontWeight:700}}>{fmt(p.venta)}</div>
                        </div>
                      </div>
                    ))}
                    {disponibles.length===0&&(
                      <div style={{gridColumn:'1/-1',color:C.muted,fontSize:12,textAlign:'center',padding:'24px 0'}}>
                        Sin productos{prodSearch?` para "${prodSearch}"`:' con stock'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DROPDOWN LISTA (modo normal) */}
              {!galeriaVisible && showDrop && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,zIndex:50,maxHeight:320,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                  {prodSearch ? (
                    // Con búsqueda activa: mostrar resultados filtrados
                    disponibles.length===0
                      ? <div style={{padding:12,color:C.muted,fontSize:12,textAlign:'center'}}>Sin resultados para "{prodSearch}"</div>
                      : disponibles.map(p=>(
                          <div key={p.id} onMouseDown={e=>{e.preventDefault();addItemDirect(p)}}
                            style={{padding:'8px 12px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.card}
                            onMouseLeave={e=>e.currentTarget.style.background=''}>
                            {(p.foto || p.imagen) && <img src={p.foto || p.imagen} alt="" style={{width:30,height:30,objectFit:'cover',borderRadius:5,flexShrink:0}}/>}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                              <div style={{fontSize:11,color:C.muted}}>{p.sku} · stock: {p.stock}</div>
                            </div>
                            <span style={{fontFamily:'monospace',color:C.accent,fontSize:13,fontWeight:700,flexShrink:0}}>{fmt(p.venta)}</span>
                          </div>
                        ))
                  ) : (
                    // Sin búsqueda: sección "más vendidos" + "todos"
                    <>
                      {topProds.length>0 && (
                        <>
                          <div style={{padding:'6px 12px 4px',fontSize:10,fontWeight:700,color:C.accent,textTransform:'uppercase',letterSpacing:1,background:C.card,position:'sticky',top:0}}>
                            ⭐ Más vendidos
                          </div>
                          {topProds.map(p=>(
                            <div key={`top-${p.id}`} onMouseDown={e=>{e.preventDefault();addItemDirect(p)}}
                              style={{padding:'8px 12px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}
                              onMouseEnter={e=>e.currentTarget.style.background=C.card}
                              onMouseLeave={e=>e.currentTarget.style.background=''}>
                              {(p.foto || p.imagen) && <img src={p.foto || p.imagen} alt="" style={{width:28,height:28,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                                <div style={{fontSize:11,color:C.muted}}>{p.sku} · stock: {p.stock}</div>
                              </div>
                              <span style={{fontFamily:'monospace',color:C.accent,fontSize:13,fontWeight:700,flexShrink:0}}>{fmt(p.venta)}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div style={{padding:'6px 12px 4px',fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,background:C.card,position:'sticky',top:0}}>
                        📦 Todos los productos ({disponibles.length})
                      </div>
                      {disponibles.map(p=>(
                        <div key={`all-${p.id}`} onMouseDown={e=>{e.preventDefault();addItemDirect(p)}}
                          style={{padding:'7px 12px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.card}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          {(p.foto || p.imagen) && <img src={p.foto || p.imagen} alt="" style={{width:26,height:26,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre}</div>
                            <div style={{fontSize:10,color:C.muted}}>{p.sku} · stock: {p.stock}</div>
                          </div>
                          <span style={{fontFamily:'monospace',color:C.accent,fontSize:12,fontWeight:700,flexShrink:0}}>{fmt(p.venta)}</span>
                        </div>
                      ))}
                      {disponibles.length===0 && <div style={{padding:12,color:C.muted,fontSize:12,textAlign:'center'}}>Sin productos con stock en esta categoría</div>}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Items — FIX: key por índice para evitar bugs de renderizado */}
            <div style={{minHeight:100,background:C.surface,borderRadius:8,padding:8,marginBottom:10}} onClick={()=>setShowDrop(false)}>
              {items.length===0
                ? <p style={{color:C.muted,fontSize:13,textAlign:'center',margin:'22px 0'}}>Buscá y seleccioná productos arriba</p>
                : items.map((item,idx)=>(
                  <div key={`item-${idx}`} style={{padding:'6px 4px',borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:500,flex:1}}>{item.nombre}</span>
                      <button onClick={()=>setItems(prev=>prev.filter((_,i)=>i!==idx))}
                        style={{background:'none',border:'none',color:C.red,cursor:'pointer',padding:'0 4px'}}><X size={13}/></button>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'flex-end',flexWrap:'wrap'}}>
                      <div style={{flex:'0 0 64px'}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Cant.</div>
                        <input type="number" min={1} value={item.qty}
                          onChange={e=>updateItem(idx,'qty',e.target.value)}
                          style={{...s.input,padding:'4px 6px',fontSize:12,fontFamily:'monospace',width:'100%'}}/>
                      </div>
                      <div style={{flex:'0 0 90px'}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Tipo precio</div>
                        <select value={item.precioTipo||'lista'} onChange={e=>updateItem(idx,'precioTipo',e.target.value)}
                          style={{...s.input,padding:'4px 6px',fontSize:11,width:'100%'}}>
                          <option value="lista">Lista</option>
                          <option value="pct">% Gan.</option>
                        </select>
                      </div>
                      {item.precioTipo==='pct' && (
                        <div style={{flex:'0 0 68px'}}>
                          <div style={{fontSize:10,color:C.muted,marginBottom:2}}>% Gan.</div>
                          <input type="number" min={0} step={1} value={item.pct||0}
                            onChange={e=>updateItem(idx,'pct',e.target.value)}
                            style={{...s.input,padding:'4px 6px',fontSize:12,fontFamily:'monospace',width:'100%',borderColor:C.accent}}/>
                        </div>
                      )}
                      <div style={{flex:1,minWidth:80}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Precio unit.</div>
                        <input type="number" value={item.precio}
                          onChange={e=>updateItem(idx,'precio',e.target.value)}
                          style={{...s.input,padding:'4px 6px',fontSize:12,fontFamily:'monospace',width:'100%'}}/>
                      </div>
                      <div style={{flex:'0 0 58px'}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Desc%</div>
                        <input type="number" min={0} max={100} value={item.descuento||0}
                          onChange={e=>updateItem(idx,'descuento',e.target.value)}
                          style={{...s.input,padding:'4px 6px',fontSize:12,fontFamily:'monospace',width:'100%'}}/>
                      </div>
                      <div style={{flex:'0 0 90px',textAlign:'right'}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Subtotal</div>
                        <div style={{fontFamily:'monospace',fontWeight:700,color:C.accent,fontSize:14}}>{fmt(item.subtotal)}</div>
                      </div>
                    </div>
                    {item.precioTipo==='pct'&&item.costo>0&&(
                      <div style={{fontSize:10,color:C.muted,marginTop:3}}>
                        Costo: {fmt(item.costo)} → lista: {fmt(prodMap[item.prodId]?.venta||0)} → con {item.pct||0}%: {fmt(Math.round(item.costo*(1+(item.pct||0)/100)))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>

            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:`2px solid ${C.border}`}}>
              <span style={{fontSize:15,fontWeight:700,color:C.white}}>Total</span>
              <span style={{fontSize:22,fontWeight:800,color:C.accent,fontFamily:'monospace'}}>{fmt(total)}</span>
            </div>
            <button style={{...s.btn(tipoDoc==='presupuesto'?'blue':'primary'),width:'100%',justifyContent:'center',padding:12,marginTop:8,opacity:(!items.length)?0.5:1}}
              onClick={finalizar} disabled={!items.length}>
              <CheckCircle2 size={15}/> {tipoDoc==='presupuesto'?'Guardar Presupuesto':tipoDoc==='remito'?'Guardar Remito':'Cobrar'}
            </button>
          </div>

          {/* Derecha — compacta arriba, top vendidos abajo */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>

            {/* Contadores COMPACTOS */}
            <div style={{...s.card,padding:'10px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:10,fontWeight:700,color:C.subtle,textTransform:'uppercase',letterSpacing:1}}>Contadores</span>
                <button onClick={resetCont} style={{fontSize:9,color:C.muted,background:'none',border:`1px solid ${C.border}`,borderRadius:4,padding:'1px 6px',cursor:'pointer'}}>Reset</button>
              </div>
              <div style={{display:'flex',gap:6}}>
                {[{key:'compro',label:'Compró',color:C.green},{key:'noCompro',label:'No compró',color:C.yellow},{key:'noTengo',label:'No tengo',color:C.red}].map(c=>(
                  <div key={c.key} style={{flex:1,textAlign:'center',background:C.surface,borderRadius:6,padding:'6px 4px',border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:22,fontWeight:800,color:c.color,fontFamily:'monospace',lineHeight:1}}>{cont[c.key]||0}</div>
                    <div style={{fontSize:9,color:C.muted,margin:'2px 0 4px'}}>{c.label}</div>
                    <div style={{display:'flex',gap:3,justifyContent:'center'}}>
                      <button onClick={()=>incCont(c.key)} style={{...s.btn('ghost'),padding:'1px 7px',fontSize:12}}>+</button>
                      <button onClick={()=>decCont(c.key)} style={{...s.btn('ghost'),padding:'1px 7px',fontSize:12}}>−</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cobros del día COMPACTOS */}
            <div style={{...s.card,padding:'10px 14px'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.subtle,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Cobros del día</div>
              {FORMAS_PAGO.filter(f=>(cobrosHoy[f]||0)>0).map(f=>(
                <div key={f} style={{display:'flex',justifyContent:'space-between',padding:'3px 0'}}>
                  <span style={{fontSize:12,color:C.muted}}>{f}</span>
                  <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:C.green}}>{fmt(cobrosHoy[f])}</span>
                </div>
              ))}
              {FORMAS_PAGO.every(f=>!(cobrosHoy[f]||0)) && <div style={{fontSize:12,color:C.muted}}>Sin cobros aún</div>}
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0 0',marginTop:4,borderTop:`1px solid ${C.border}`}}>
                <span style={{fontSize:12,fontWeight:700,color:C.white}}>Total</span>
                <span style={{fontFamily:'monospace',fontSize:14,fontWeight:800,color:C.accent}}>{fmt(Object.values(cobrosHoy).reduce((a,b)=>a+b,0))}</span>
              </div>
            </div>

            {/* Top 7 más vendidos — pie del panel */}
            <div style={{...s.card,padding:'10px 14px'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.subtle,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>⭐ Top 7 — clic para agregar</div>
              {topProds.length===0
                ? <div style={{color:C.muted,fontSize:12,textAlign:'center',padding:'10px 0'}}>Sin datos aún</div>
                : topProds.slice(0,7).map((p,i)=>(
                  <div key={p.id} onClick={()=>addItemDirect(p)}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 2px',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:9,color:C.muted,minWidth:14}}>{i+1}.</span>
                      <span style={{fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>{p.nombre}</span>
                    </div>
                    <span style={{fontFamily:'monospace',fontSize:11,color:C.accent,fontWeight:600,flexShrink:0}}>{fmt(p.venta)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      ) : (
        <div style={s.card}>
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{position:'relative',flex:1,maxWidth:260}}>
              <Search size={13} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
              <input style={{...s.input,paddingLeft:28}} placeholder="Buscar cliente..." value={searchHist} onChange={e=>setSearchHist(e.target.value)}/>
            </div>
            <div style={{display:'flex',gap:6}}>
              {[{id:'todos',label:'Todos'},{id:'venta',label:'Ventas'},{id:'presupuesto',label:'Presupuestos'}].map(t=>(
                <button key={t.id} onClick={()=>setFiltroTipo(t.id)} style={s.pill(filtroTipo===t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <table style={s.table}>
            <thead><tr>{['#','Fecha','Cliente','Tipo','Pago','Total','Estado',''].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filteredHist.map(v=>{
                const cl=clientes.find(c=>c.id===v.clienteId)
                const esPres=v.tipo==='presupuesto'
                return <TR key={v.id} onClick={()=>setDocAbierto(v)}>
                  <td style={{...s.td,fontFamily:'monospace',color:C.muted,fontSize:11}}>#{String(v.id).padStart(4,'0')}</td>
                  <td style={s.td}>{fmtDate(v.fecha)}</td>
                  <td style={{...s.td,fontWeight:500,color:C.white}}>{cl?.nombre}</td>
                  <td style={s.td}><span style={s.badge(esPres?C.blue:C.green)}>{esPres?'Presup.':'Venta'}</span></td>
                  <td style={{...s.td,fontSize:12,color:C.muted}}>{v.formaPago||'—'}</td>
                  <td style={{...s.td,fontFamily:'monospace',color:C.accent,fontWeight:700}}>{fmt(v.total)}</td>
                  <td style={s.td}><span style={s.badge(v.estado==='completada'?C.green:C.blue)}>{v.estado}</span></td>
                  <td style={s.td}><Eye size={13} color={C.muted}/></td>
                </TR>
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPago && <PagoModal total={total} onConfirm={confirmarCobro} onClose={()=>setShowPago(false)} configAdmin={configAdmin}/>}
      {presAConvertir && <PagoModal total={presAConvertir.total} onConfirm={confirmarConversion} onClose={()=>setPresAConvertir(null)} configAdmin={configAdmin}/>}
      {docAbierto && (
        <DocModal venta={docAbierto} clientes={clientes} productos={productos}
          onClose={()=>setDocAbierto(null)}
          onConvertir={docAbierto.tipo==='presupuesto'?convertirAFactura:null}
          configAdmin={configAdmin}/>
      )}
      {ventaEmitida && (
        <EnviarFacturaModal
          venta={ventaEmitida}
          cliente={clientes.find(c=>c.id===ventaEmitida.clienteId)}
          productosMap={prodMap}
          onClose={()=>setVentaEmitida(null)}/>
      )}
    </div>
  )
}
