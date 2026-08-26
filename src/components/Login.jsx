import React, { useState } from 'react'
import { Wrench, Lock, User, Eye, EyeOff } from 'lucide-react'

export default function Login({ onLogin }) {
  const [user, setUser]     = useState('')
  const [pass, setPass]     = useState('')
  const [showPass, setShow] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTimeout(() => {
      // Leer config guardada (usuario/pass personalizados)
      let configAdmin = null
      try { configAdmin = JSON.parse(localStorage.getItem('ferreteria_configAdmin')) } catch {}
      
      const customUser = configAdmin?.loginUser
      const customPass = configAdmin?.loginPass
      const customNombre = configAdmin?.nombreCompleto || configAdmin?.nombreLocal || 'Administrador'

      // Usuarios base + usuario personalizado
      const USUARIOS = [
        { user: 'pato', pass: 'Pato1234', nombre: 'Pato', rol: 'admin' },
        { user: 'admin', pass: 'admin', nombre: 'Administrador', rol: 'admin' },
        { user: 'vendedor', pass: 'vendedor', nombre: 'Vendedor', rol: 'vendedor' },
      ]
      if (customUser && customPass) {
        USUARIOS.push({ user: customUser.toLowerCase(), pass: customPass, nombre: customNombre, rol: 'admin' })
      }

      const found = USUARIOS.find(u => u.user === user.toLowerCase() && u.pass === pass)
      if (found) {
        onLogin(found)
      } else {
        setError('Usuario o contraseña incorrectos')
        setLoading(false)
      }
    }, 400)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080b12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ width: 380, padding: '40px 36px', background: '#0f1320', border: '1px solid #1f2840', borderRadius: 16 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <div style={{ background: '#f97316', borderRadius: 10, padding: '10px 12px' }}>
            <Wrench size={22} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '-0.5px' }}>Ferretería</div>
            <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: 2, textTransform: 'uppercase' }}>Pro System</div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>Iniciar sesión</div>
        <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 28 }}>Ingresá tus credenciales para continuar</div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#8896a7', fontWeight: 500, marginBottom: 6, display: 'block' }}>Usuario</label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a5568' }}/>
              <input
                style={{ width: '100%', background: '#161c2e', border: `1px solid ${error?'#ef4444':'#1f2840'}`, borderRadius: 8, padding: '10px 12px 10px 36px', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="admin"
                value={user}
                onChange={e => { setUser(e.target.value); setError('') }}
                autoFocus
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: '#8896a7', fontWeight: 500, marginBottom: 6, display: 'block' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a5568' }}/>
              <input
                type={showPass ? 'text' : 'password'}
                style={{ width: '100%', background: '#161c2e', border: `1px solid ${error?'#ef4444':'#1f2840'}`, borderRadius: 8, padding: '10px 36px 10px 36px', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="••••••"
                value={pass}
                onChange={e => { setPass(e.target.value); setError('') }}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', padding: 2 }}>
                {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#f97316', border: 'none', borderRadius: 8, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.8 : 1 }}>
            {loading ? <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/> : null}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '12px 14px', background: '#161c2e', borderRadius: 8, fontSize: 11, color: '#4a5568' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#8896a7' }}>Credenciales de acceso:</div>
          <div>Admin: <span style={{ color: '#f97316' }}>Pato / Pato1234</span></div>
          <div>Vendedor: <span style={{ color: '#f97316' }}>vendedor / vendedor</span></div>
        </div>
      </div>
    </div>
  )
}
