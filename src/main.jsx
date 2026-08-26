import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import App from './App'

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', padding:24 }}>
        <div style={{ background:'#1a1f2e', border:'1px solid #ef444440', borderRadius:16, padding:32, maxWidth:520, width:'100%' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
          <div style={{ fontWeight:800, fontSize:18, color:'#fff', marginBottom:8 }}>Algo salió mal</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginBottom:20, lineHeight:1.6 }}>
            La aplicación encontró un error inesperado. Podés intentar recargar la página. Si el problema persiste, usá el botón de abajo para limpiar el caché.
          </div>
          <pre style={{ fontSize:11, color:'#ef4444', background:'#0f1117', borderRadius:8, padding:12, overflowX:'auto', marginBottom:20, whiteSpace:'pre-wrap' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>window.location.reload()}
              style={{ background:'#f97316', border:'none', borderRadius:8, padding:'10px 20px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}>
              🔄 Recargar
            </button>
            <button onClick={()=>{ localStorage.clear(); window.location.reload() }}
              style={{ background:'transparent', border:'1px solid #475569', borderRadius:8, padding:'10px 20px', color:'#94a3b8', cursor:'pointer', fontSize:13 }}>
              🗑 Limpiar caché y recargar
            </button>
          </div>
        </div>
      </div>
    )
  }
}

// ── Splash / Loading Screen ───────────────────────────────────────────────────
function SplashScreen({ fade }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0f1117', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.5s ease', opacity: fade ? 0 : 1, pointerEvents: 'none'
    }}>
      {/* Logo animado */}
      <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 24 }}>
        {/* Círculo giratorio */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid #1e293b',
          borderTop: '3px solid #f97316',
          animation: 'spin 0.9s linear infinite'
        }}/>
        {/* Logo central */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img src="/logo.png" alt="logo"
            style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8 }}/>
        </div>
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: -1, marginBottom: 6 }}>
        Ferretería <span style={{ color: '#f97316' }}>Pro</span>
      </div>
      <div style={{ fontSize: 12, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 32 }}>
        by Zencio · Cargando sistema...
      </div>

      {/* Barra de progreso */}
      <div style={{ width: 200, height: 3, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg, #f97316, #fb923c)',
          borderRadius: 99, animation: 'loadbar 1.4s ease-in-out infinite'
        }}/>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@800&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes loadbar {
          0%   { width: 0%;   margin-left: 0; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
function Root() {
  const [splashFade, setSplashFade] = React.useState(false)
  const [splashDone, setSplashDone] = React.useState(false)

  React.useEffect(() => {
    // Esperar a que los recursos carguen, luego fade out
    const t1 = setTimeout(() => setSplashFade(true),  900)
    const t2 = setTimeout(() => setSplashDone(true), 1450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <>
      {!splashDone && <SplashScreen fade={splashFade} />}
      <ThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    </>
  )
}

// Limpiar solo keys corruptos
try {
  ['ferreteria_productos','ferreteria_ventas','ferreteria_clientes'].forEach(k => {
    const v = localStorage.getItem(k)
    if (v) JSON.parse(v)
  })
} catch {
  ['ferreteria_productos','ferreteria_ventas','ferreteria_clientes'].forEach(k => {
    try { JSON.parse(localStorage.getItem(k)||'null') } catch { localStorage.removeItem(k) }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
