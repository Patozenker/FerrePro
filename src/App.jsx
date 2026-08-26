import React, { useState, useEffect } from 'react'
import { BarChart2, Package, ShoppingCart, Users, Truck, ClipboardList, TrendingUp, AlertTriangle, Sun, Moon, LogOut, Calendar, Download, Upload } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { useStorage, clearStorage, getApiUrl } from './useStorage'
import { setDateOverride } from './utils'
import {
  initProductos, initClientes, initProveedores, initVentas,
  initPedidos, initPagos, initHistorialPrecios, initDescuentos, CATS_DEFAULT, DATA_VERSION
} from './data'
import Login         from './components/Login'
import Dashboard     from './components/Dashboard'
import Inventario    from './components/Inventario'
import Ventas        from './components/Ventas'
import Clientes      from './components/Clientes'
import Proveedores   from './components/Proveedores'
import Pedidos       from './components/Pedidos'
import Metricas      from './components/Metricas'
import Calendario    from './components/Calendario'
import ConfigAdmin   from './components/ConfigAdmin'

const MODULES = [
  { id:"dashboard",   label:"Dashboard",    icon:BarChart2    },
  { id:"inventario",  label:"Inventario",   icon:Package      },
  { id:"ventas",      label:"Ventas / Caja",icon:ShoppingCart },
  { id:"clientes",    label:"Clientes",     icon:Users        },
  { id:"proveedores", label:"Proveedores",  icon:Truck        },
  { id:"pedidos",     label:"Pedidos",      icon:ClipboardList},
  { id:"metricas",    label:"Métricas",     icon:TrendingUp   },
  { id:"calendario",  label:"Calendario",   icon:Calendar     },
]


// ── BackupModal ───────────────────────────────────────────────────────────────
function BackupModal({ onClose, allData, onRestore }) {
  const handleExport = () => {
    const json = JSON.stringify(allData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ferreteria-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.productos || !data.ventas) {
          alert('Archivo inválido — no parece un backup de Ferretería Pro')
          return
        }
        if (!confirm(`¿Restaurar backup del ${data._fecha||'fecha desconocida'}?\n\nEsto REEMPLAZARÁ todos los datos actuales.`)) return
        onRestore(data)
        onClose()
        alert('✅ Datos restaurados correctamente')
      } catch { alert('Error al leer el archivo') }
    }
    reader.readAsText(file)
  }
  const fileRef = React.useRef()
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999 }} onClick={onClose}>
      <div style={{ background:'#1a1f2e',border:'1px solid #334155',borderRadius:16,padding:28,width:420,maxWidth:'95vw' }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:800,color:'#fff',fontSize:18,marginBottom:6 }}>💾 Backup & Restaurar</div>
        <div style={{ fontSize:13,color:'#94a3b8',marginBottom:24,lineHeight:1.6 }}>
          Exportá todos los datos como un archivo .json para hacer backup, o importá un backup anterior para restaurar.
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <button onClick={handleExport}
            style={{ display:'flex',alignItems:'center',gap:10,padding:'14px 20px',background:'#f97316',border:'none',borderRadius:10,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14 }}>
            <span style={{fontSize:20}}>⬇️</span>
            <div style={{textAlign:'left'}}>
              <div>Exportar backup</div>
              <div style={{fontSize:11,fontWeight:400,opacity:0.85}}>Descarga un .json con todos tus datos</div>
            </div>
          </button>
          <button onClick={()=>fileRef.current.click()}
            style={{ display:'flex',alignItems:'center',gap:10,padding:'14px 20px',background:'#1e293b',border:'1px solid #475569',borderRadius:10,color:'#e2e8f0',fontWeight:700,cursor:'pointer',fontSize:14 }}>
            <span style={{fontSize:20}}>⬆️</span>
            <div style={{textAlign:'left'}}>
              <div>Importar backup</div>
              <div style={{fontSize:11,fontWeight:400,opacity:0.7}}>Restaura desde un archivo .json</div>
            </div>
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={handleImport}/>
        </div>
        <div style={{ marginTop:20,padding:'10px 14px',background:'#0f172a',borderRadius:8,fontSize:11,color:'#64748b' }}>
          ⚠️ La restauración reemplaza todos los datos actuales. Se recomienda exportar primero como copia de seguridad.
        </div>

        {/* Reset de datos */}
        <div style={{ marginTop:16, padding:'14px', background:'#1a0a0a', borderRadius:8, border:'1px solid #ef444430' }}>
          <div style={{ fontWeight:700, color:'#ef4444', fontSize:13, marginBottom:6 }}>🗑️ Resetear datos</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>
            Borra todos los productos, ventas, clientes y proveedores cargados y vuelve a los datos de ejemplo. No borra la configuración del local.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{
            if (!confirm(`¿Resetear TODOS los datos operativos?

Se borrarán:
• Productos
• Clientes
• Proveedores`)) {
  return;
}
              onFullReset()
              onClose()
            }} style={{ padding:'8px 16px',background:'#ef444420',border:'1px solid #ef4444',borderRadius:8,color:'#ef4444',fontWeight:700,cursor:'pointer',fontSize:12 }}>
              🗑️ Resetear datos operativos
            </button>
          </div>
        </div>

        <div style={{ display:'flex',justifyContent:'flex-end',marginTop:16 }}>
          <button onClick={onClose} style={{ padding:'8px 20px',background:'none',border:'1px solid #334155',borderRadius:8,color:'#94a3b8',cursor:'pointer' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { C, s, dark, setDark } = useTheme()

  // ── Migración de datos ────────────────────────────────────────────────────
  // Si el DATA_VERSION guardado en localStorage no coincide con el actual,
  // se borran todos los datos operativos (productos, clientes, etc.) pero
  // se conserva la configuración del local (configAdmin).
  // Esto garantiza que al actualizar a la versión "clean" no cargue demo data.
  const DATA_KEYS = ['productos','clientes','proveedores','ventas','pedidos','pagos','historialPrecios','descuentos','categoriasExtra','pagosServicios']
  const storedVersion = localStorage.getItem('ferreteria_data_version')
  if (storedVersion !== DATA_VERSION) {
    DATA_KEYS.forEach(k => localStorage.removeItem(`ferreteria_${k}`))
    localStorage.setItem('ferreteria_data_version', DATA_VERSION)
  }

  const [ahora, setAhora] = useState(new Date())
  useEffect(()=>{ const t=setInterval(()=>setAhora(new Date()),30000); return ()=>clearInterval(t) },[])
  const fechaHora = ahora.toLocaleString('es-AR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})

  const [usuario, setUsuario] = useState(() => {
    try { const raw = sessionStorage.getItem('ferreteria_session'); return raw ? JSON.parse(raw) : null } catch { return null }
  })
  const handleLogin  = (u) => { try { sessionStorage.setItem('ferreteria_session', JSON.stringify(u)) } catch {}; setUsuario(u) }
  const handleLogout = () => { try { sessionStorage.removeItem('ferreteria_session') } catch {}; setUsuario(null) }

  const [productos,        setProductos]        = useStorage('productos',        initProductos)
  const [clientes,         setClientes]         = useStorage('clientes',         initClientes)
  const [proveedores,      setProveedores]      = useStorage('proveedores',      initProveedores)
  const [ventas,           setVentas]           = useStorage('ventas',           initVentas)
  const [pedidos,          setPedidos]          = useStorage('pedidos',          initPedidos)
  const [pagos,            setPagos]            = useStorage('pagos',            initPagos)
  const [_historialPrecios, _setHistorialPrecios] = useStorage('historialPrecios', initHistorialPrecios)
  // Normalizar: el historial puede venir como array plano o como {precios:[],descuentos:[]} (formato viejo)
  const toArray = (v) => Array.isArray(v) ? v : (Array.isArray(v?.precios) ? v.precios : [])
  const historialPrecios = toArray(_historialPrecios)
  const setHistorialPrecios = (updater) => {
    if (typeof updater === 'function') {
      _setHistorialPrecios(prev => toArray(updater(toArray(prev))))
    } else {
      _setHistorialPrecios(toArray(updater))
    }
  }
  const [_descuentos, _setDescuentos] = useStorage('descuentos', initDescuentos)
  // Normalize descuentos (may be buried in old historial object)
  const descuentos = Array.isArray(_descuentos) ? _descuentos
    : Array.isArray(_descuentos?.descuentos) ? _descuentos.descuentos : []
  const setDescuentos = (u) => _setDescuentos(typeof u==='function'
    ? prev => u(Array.isArray(prev)?prev:(prev?.descuentos||[]))
    : (Array.isArray(u)?u:(u?.descuentos||[])))
  const [categoriasExtra,  setCategoriasExtra]  = useStorage('categoriasExtra',  [])
  const [pagosServicios,   setPagosServicios]   = useStorage('pagosServicios',   [])
  const [configAdmin,      setConfigAdmin]      = useStorage('configAdmin', {
    nombreLocal:'Ferretería', cotizacionUSD:1200,
    condIva:'Resp. Inscripto', logoCustom:null
  })
  const [showBackup,       setShowBackup]       = useState(false)
  const [showConfig,       setShowConfig]       = useState(false)
  const [active,           setActive]           = useState("dashboard")
  const [editProdId,       setEditProdId]       = useState(null)

  // ── Primer uso: abrir ConfigAdmin si el nombre sigue siendo el default ──────
  // Se abre una sola vez por sesión (sessionStorage evita que vuelva a aparecer
  // si el usuario cierra sin guardar y navega entre pestañas)
  useEffect(() => {
    const esDefault = !configAdmin.nombreLocal || configAdmin.nombreLocal === 'Ferretería'
    const yaAbierto = sessionStorage.getItem('config_opened_this_session')
    if (esDefault && !yaAbierto) {
      sessionStorage.setItem('config_opened_this_session', '1')
      setShowConfig(true)
    }
  }, []) // eslint-disable-line

  const handleReset = () => {
    if (!confirm('¿Resetear TODOS los datos? Esta acción no se puede deshacer.')) return
    clearStorage(); window.location.reload()
  }

  // Cumpleaños — DEBE ir antes del early return (regla de hooks de React)
  // Test date override — sincroniza el módulo utils para que today() lo respete
  const [testDate, setTestDateState] = React.useState(null)
  const [showTestDate, setShowTestDate] = React.useState(false)
  const setTestDate = (d) => { setDateOverride(d); setTestDateState(d) }

  React.useEffect(() => {
    setDateOverride(testDate)
  }, [testDate])

  const [showBday, setShowBday] = React.useState(() => {
    const fn = configAdmin?.fechaNac
    if (!fn) return false
    const hoyS = new Date().toISOString().slice(5,10)
    const nacS = fn.slice(5,10)
    const shown = sessionStorage.getItem('bday_shown')
    return hoyS === nacS && shown !== 'yes'
  })

  if (!usuario) return <Login onLogin={handleLogin}/>

  // ── Notificaciones Mercado Pago (polling cada 15s si está configurado y hay backend) ──
  const [mpNotifs, setMpNotifs] = React.useState([])
  React.useEffect(() => {
    const apiUrl = getApiUrl()
    if (!configAdmin.mpLink || !apiUrl) return
    const poll = async () => {
      try {
        const r = await fetch(`${apiUrl}/api/mp/notifs`)
        const j = await r.json()
        if (j.ok && j.data?.length) {
          const pending = j.data.filter(n => n.estado === 'pending')
          if (pending.length > 0) setMpNotifs(pending)
        }
      } catch {}
    }
    poll()
    const t = setInterval(poll, 15000)
    return () => clearInterval(t)
  }, [configAdmin.mpLink])


  const allBackupData = {
    _fecha: new Date().toLocaleDateString('es-AR'),
    _version: '5.2',
    productos, clientes, proveedores, ventas, pedidos, pagos,
    historialPrecios, descuentos, categoriasExtra, pagosServicios, configAdmin
  }
  const handleRestore = (data) => {
    if (data.productos)        setProductos(data.productos)
    if (data.clientes)         setClientes(data.clientes)
    if (data.proveedores)      setProveedores(data.proveedores)
    if (data.ventas)           setVentas(data.ventas)
    if (data.pedidos)          setPedidos(data.pedidos)
    if (data.pagos)            setPagos(data.pagos)
    if (data.historialPrecios) setHistorialPrecios(data.historialPrecios)
    if (data.descuentos)       setDescuentos(data.descuentos)
    if (data.categoriasExtra)  setCategoriasExtra(data.categoriasExtra)
    if (data.pagosServicios)   setPagosServicios(data.pagosServicios)
    if (data.configAdmin)      setConfigAdmin(data.configAdmin)
  }

  const handleFullReset = async () => {
    const keys = ['productos','ventas','clientes','proveedores','pedidos','pagos','historialPrecios','descuentos','categoriasExtra','pagosServicios']
    // Reset localStorage
    keys.forEach(k => localStorage.removeItem('ferreteria_' + k))
    // Reset server DB si hay backend disponible
    const apiUrl = getApiUrl()
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/api/reset`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({keys})
        })
      } catch {}
    }
    window.location.reload()
  }

  const allCats      = [...CATS_DEFAULT, ...categoriasExtra]
  const stockAlertas = productos.filter(p => p.stock <= p.minStock).length
  const pedidosPend  = pedidos.filter(p => p.estado === "pendiente" || p.estado === "enviado").length

  // Alertas de vencimiento de pago en los próximos 7 días
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const en7  = new Date(hoy); en7.setDate(hoy.getDate()+7)
  const vencimientosProximos = pedidos.filter(p => {
    if (!p.fechaPago) return false
    const fp = new Date(p.fechaPago + 'T00:00:00')
    return fp >= hoy && fp <= en7
  }).length
  const serviciosProximos = pagosServicios.filter(ps => {
    if (!ps.fechaProx) return false
    const fp = new Date(ps.fechaProx + 'T00:00:00')
    return fp >= hoy && fp <= en7
  }).length
  const alertasCalendario = vencimientosProximos + serviciosProximos

  const mod = MODULES.find(m => m.id === active) || MODULES[0]

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dark?"#252b3b":"#cbd5e1"}; border-radius:3px; }
        input, select, textarea { font-family: inherit; }
        input:focus, select:focus, textarea:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 2px ${C.accentDim}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        @media print { aside, header, .no-print { display: none !important; } .print-only { display: block !important; } }
        .print-only { display: none; }
      `}</style>

      <aside style={s.sidebar}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src={configAdmin.logoCustom||"/logo.png"} alt="logo" style={{ width:44, height:44, objectFit:'contain', borderRadius:8 }}/>
            <div>
              <div style={{ fontSize:17, fontWeight:800, letterSpacing:"-0.5px", color:C.white, fontFamily:"'IBM Plex Mono',monospace" }}>{configAdmin.nombreLocal||'Ferretería'}</div>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase" }}>by Zencio</div>
            </div>
          </div>
        </div>

        <nav style={s.nav}>
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setActive(m.id)} style={s.navItem(active === m.id)}>
              <m.icon size={16}/>
              <span style={{ flex:1 }}>{m.label}</span>
              {m.id === "inventario" && stockAlertas > 0 &&
                <span style={{ background:C.yellow, color:"#000", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:800 }}>{stockAlertas}</span>}
              {m.id === "pedidos" && pedidosPend > 0 &&
                <span style={{ background:C.blue, color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:800 }}>{pedidosPend}</span>}
              {m.id === "calendario" && alertasCalendario > 0 &&
                <span style={{ background:C.red, color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:800 }}>{alertasCalendario}</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>
              <div>v6.2</div>
              <div style={{ color:C.subtle }}>{fechaHora}</div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={()=>setShowBackup(true)} title="Backup & Restaurar"
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 7px", cursor:"pointer", color:C.subtle, display:"flex", alignItems:"center" }}>
                <Download size={12}/>
              </button>
              <button onClick={() => setDark(!dark)}
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 8px", cursor:"pointer", color:C.subtle, display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
                {dark ? <Sun size={12}/> : <Moon size={12}/>} {dark ? "Claro" : "Oscuro"}
              </button>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.subtle, fontWeight:500 }}>{usuario.nombre}</span>
            <button onClick={handleLogout}
              style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 8px", cursor:"pointer", color:C.red, display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
              <LogOut size={12}/> Salir
            </button>
          </div>
        </div>
      </aside>

      <div style={s.main}>
        <header style={s.topbar}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <mod.icon size={16} color={C.accent}/>
            <span style={{ fontSize:15, fontWeight:700, color:C.white }}>{mod.label}</span>
          </div>
          {(stockAlertas > 0 || alertasCalendario > 0) && (
            <div style={{ display:"flex", gap:8 }}>
              {stockAlertas > 0 && (
                <div onClick={() => setActive("inventario")}
                  style={{ display:"flex", alignItems:"center", gap:6, background:`${C.yellow}15`, border:`1px solid ${C.yellow}40`, borderRadius:8, padding:"4px 10px", fontSize:12, color:C.yellow, cursor:"pointer" }}>
                  <AlertTriangle size={12}/> {stockAlertas} alertas stock
                </div>
              )}
              {alertasCalendario > 0 && (
                <div onClick={() => setActive("calendario")}
                  style={{ display:"flex", alignItems:"center", gap:6, background:`${C.red}15`, border:`1px solid ${C.red}40`, borderRadius:8, padding:"4px 10px", fontSize:12, color:C.red, cursor:"pointer" }}>
                  <Calendar size={12}/> {alertasCalendario} vencimiento{alertasCalendario>1?'s':''}
                </div>
              )}
            </div>
          )}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
            {/* Test date override */}
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              {showTestDate ? (
                <>
                  <span style={{ fontSize:10, color:C.muted }}>📅 Fecha test:</span>
                  <input type="date" value={testDate || new Date().toISOString().slice(0,10)}
                    onChange={e=>setTestDate(e.target.value)}
                    style={{ background:C.surface, border:`1px solid ${C.accent}`, borderRadius:6,
                      color:C.white, fontSize:11, padding:'3px 6px', width:120 }}/>
                  <button onClick={()=>{setTestDate(null);setShowTestDate(false)}}
                    style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:12 }}>✕</button>
                </>
              ) : (
                <button onClick={()=>setShowTestDate(true)}
                  title="Cambiar fecha para probar gráficos"
                  style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6,
                    padding:'3px 8px', cursor:'pointer', color:C.muted, fontSize:10 }}>
                  📅 Fecha
                </button>
              )}
            </div>
            {/* MP payment notification */}
            {mpNotifs.length > 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:6,background:'#009ee315',border:'1px solid #009ee350',borderRadius:8,padding:'5px 12px',fontSize:12,color:'#009ee3',cursor:'pointer',animation:'pulse 1.5s infinite' }}
                onClick={()=>{
                  if(confirm(`✅ ${mpNotifs.length} pago(s) de Mercado Pago detectado(s)!\n\nMarcá como procesado para limpiar la notificación.`)) {
                    const apiUrl = getApiUrl()
                    if (apiUrl) {
                      mpNotifs.forEach(n => fetch(`${apiUrl}/api/mp/notifs/${n.id}/done`,{method:'POST'}).catch(()=>{}))
                    }
                    setMpNotifs([])
                  }
                }}>
                💙 {mpNotifs.length} pago{mpNotifs.length>1?'s':''} MP
              </div>
            )}
            {/* Cotización dólar + WhatsApp */}
            <div style={{ display:"flex", alignItems:"center", gap:4, background:C.surface, borderRadius:8, padding:"5px 10px", border:`1px solid ${C.border}` }}>
              <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>USD</span>
              <input
                type="number"
                value={configAdmin.cotizacionUSD||1200}
                onChange={e=>setConfigAdmin(c=>({...c,cotizacionUSD:+e.target.value}))}
                onKeyDown={e=>e.key==='Enter'&&e.target.blur()}
                style={{ width:70, background:'transparent', border:'none', outline:'none', color:C.yellow, fontFamily:'monospace', fontWeight:700, fontSize:12, padding:0 }}
              />
              <span style={{ fontSize:10, color:C.muted }}>ARS</span>
            </div>
            <a
              href="https://wa.me/"
              target="_blank" rel="noreferrer"
              title="Consultar cotización por WhatsApp"
              style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, background:"#25d366", borderRadius:8, textDecoration:"none", fontSize:15, flexShrink:0 }}>
              📲
            </a>
            {/* Badge usuario — click abre config */}
            <div onClick={()=>setShowConfig(true)}
              style={{ display:"flex", alignItems:"center", gap:6, background:C.accentDim, borderRadius:8, padding:"6px 12px", fontSize:12, color:C.accent, fontWeight:600, cursor:"pointer" }}
              title="Configuración">
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.green }}/> {usuario.nombre}
            </div>
          </div>
        </header>

        <main style={s.content}>
          {active==="dashboard"   && <Dashboard   productos={productos} ventas={ventas} clientes={clientes} pedidos={pedidos} pagos={pagos} proveedores={proveedores} setActive={setActive} allCats={allCats} pagosServicios={pagosServicios} testDate={testDate}/>}
          {active==="inventario"  && <Inventario  productos={productos} setProductos={setProductos} proveedores={proveedores} categoriasExtra={categoriasExtra} setCategoriasExtra={setCategoriasExtra} editProdId={editProdId} setEditProdId={setEditProdId} historialPrecios={historialPrecios} setHistorialPrecios={setHistorialPrecios} allCats={allCats} cotizacionUSD={configAdmin.cotizacionUSD||1200}/>}
          {active==="ventas"      && <Ventas      ventas={ventas} setVentas={setVentas} productos={productos} setProductos={setProductos} clientes={clientes} setClientes={setClientes} allCats={allCats} configAdmin={configAdmin} cotizacionUSD={configAdmin.cotizacionUSD||1200} historialPrecios={historialPrecios}/>}
          {active==="clientes"    && <Clientes    clientes={clientes} setClientes={setClientes} ventas={ventas} setVentas={setVentas} productos={productos} setProductos={setProductos} configAdmin={configAdmin}/>}
          {active==="proveedores" && <Proveedores proveedores={proveedores} setProveedores={setProveedores} productos={productos} setProductos={setProductos} pedidos={pedidos} setPedidos={setPedidos} pagos={pagos} setPagos={setPagos} historialPrecios={historialPrecios} setHistorialPrecios={setHistorialPrecios} descuentos={descuentos} setDescuentos={setDescuentos} cotizacionUSD={configAdmin.cotizacionUSD||1200}/>}
          {active==="pedidos"     && <Pedidos     proveedores={proveedores} productos={productos} setProductos={setProductos} pedidos={pedidos} setPedidos={setPedidos} configAdmin={configAdmin} cotizacionUSD={configAdmin.cotizacionUSD||1200}/>}
          {active==="metricas"    && <Metricas    productos={productos} ventas={ventas} clientes={clientes} allCats={allCats} testDate={testDate}/>}
          {active==="calendario"  && <Calendario  pedidos={pedidos} ventas={ventas} proveedores={proveedores} pagosServicios={pagosServicios} setPagosServicios={setPagosServicios}/>}
        </main>
      </div>
      {showBackup && <BackupModal onClose={()=>setShowBackup(false)} allData={allBackupData} onRestore={handleRestore} onFullReset={handleFullReset}/>}
      {showConfig && <ConfigAdmin config={configAdmin} setConfig={setConfigAdmin} onClose={()=>setShowConfig(false)} dark={dark} setDark={setDark}/>}
      {showBday && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999 }}
          onClick={()=>{setShowBday(false);sessionStorage.setItem('bday_shown','yes')}}>
          <div style={{ background:C.card,border:`2px solid ${C.accent}`,borderRadius:20,padding:40,textAlign:'center',maxWidth:380 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:56,marginBottom:12 }}>🎂</div>
            <div style={{ fontSize:24,fontWeight:800,color:C.white,marginBottom:8 }}>¡Feliz cumpleaños!</div>
            <div style={{ fontSize:14,color:C.muted,marginBottom:6 }}>
              {configAdmin.nombreCompleto || usuario.nombre}
            </div>
            <div style={{ fontSize:13,color:C.subtle,marginBottom:24,lineHeight:1.6 }}>
              Que tengas un excelente día y que el negocio siga creciendo 🔧🚀
            </div>
            <button style={s.btn()} onClick={()=>{setShowBday(false);sessionStorage.setItem('bday_shown','yes')}}>
              ¡Gracias! 🎉
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
