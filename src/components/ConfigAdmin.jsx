import React, { useState, useRef } from 'react'
import { useTheme } from '../ThemeContext'

const TABS = [
  { id:'local',   label:'🏪 Local' },
  { id:'usuario', label:'👤 Usuario' },
  { id:'cobros',  label:'💳 Cobros / QR' },
  { id:'app',     label:'⚙️ App' },
]

export default function ConfigAdmin({ config, setConfig, onClose, dark, setDark }) {
  const { C, s } = useTheme()
  const [tab, setTab]   = useState('local')
  const [form, setForm] = useState({ ...config })
  const logoRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    setConfig(form)
    onClose()
  }

  const handleLogo = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const img = new window.Image()
      img.onload = () => {
        const MAX = 256
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        set('logoCustom', canvas.toDataURL('image/png', 0.9))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  const inputStyle = { ...s.input, marginBottom: 0 }
  const label = (txt) => <label style={{ ...s.label, marginBottom: 4, display:'block' }}>{txt}</label>
  const row   = (children) => <div style={{ marginBottom: 14 }}>{children}</div>
  const grid2 = (children) => <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>{children}</div>

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, width:580, maxWidth:'95vw', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontWeight:800, fontSize:17, color:C.white }}>⚙️ Configuración</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, padding:'12px 24px 0', borderBottom:`1px solid ${C.border}` }}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'7px 14px', fontSize:12, fontWeight:600, borderRadius:'8px 8px 0 0', border:`1px solid ${tab===t.id?C.accent:C.border}`, borderBottom:'none',
                background: tab===t.id ? C.accentDim : 'transparent', color: tab===t.id ? C.accent : C.muted, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>

          {/* ── LOCAL ── */}
          {tab==='local' && (
            <div>
              {row(<>
                {label('Nombre del local')}
                <input style={inputStyle} value={form.nombreLocal||''} onChange={e=>set('nombreLocal',e.target.value)} placeholder="Ferretería La Plaza"/>
              </>)}
              {grid2(<>
                <div>
                  {label('CUIT')}
                  <input style={inputStyle} value={form.cuit||''} onChange={e=>set('cuit',e.target.value)} placeholder="20-12345678-9"/>
                </div>
                <div>
                  {label('Condición IVA')}
                  <select style={inputStyle} value={form.condIva||'Resp. Inscripto'} onChange={e=>set('condIva',e.target.value)}>
                    {['Resp. Inscripto','Monotributista','Consumidor Final','Exento'].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              </>)}
              {row(<>
                {label('Domicilio')}
                <input style={inputStyle} value={form.domicilio||''} onChange={e=>set('domicilio',e.target.value)} placeholder="Av. Corrientes 1234, CABA"/>
              </>)}
              {grid2(<>
                <div>
                  {label('Teléfono')}
                  <input style={inputStyle} value={form.telLocal||''} onChange={e=>set('telLocal',e.target.value)} placeholder="011-4444-5555"/>
                </div>
                <div>
                  {label('Email')}
                  <input style={inputStyle} type="email" value={form.emailLocal||''} onChange={e=>set('emailLocal',e.target.value)}/>
                </div>
              </>)}
              {row(<>
                {label('Logo personalizado (aparece en splash y sidebar)')}
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ width:56, height:56, borderRadius:8, border:`1px solid ${C.border}`, overflow:'hidden', background:C.surface, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(form.logoCustom||'/logo.png') && <img src={form.logoCustom||'/logo.png'} alt="logo" style={{ width:52, height:52, objectFit:'contain' }}/>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button style={{ ...s.btn('ghost'), fontSize:12 }} onClick={()=>logoRef.current.click()}>📷 Cambiar logo</button>
                    {form.logoCustom && <button style={{ ...s.btn('danger'), fontSize:12 }} onClick={()=>set('logoCustom',null)}>✕ Usar default</button>}
                  </div>
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleLogo(e.target.files[0])}/>
              </>)}
            </div>
          )}

          {/* ── USUARIO ── */}
          {tab==='usuario' && (
            <div>
              {grid2(<>
                <div>
                  {label('Nombre completo')}
                  <input style={inputStyle} value={form.nombreCompleto||''} onChange={e=>set('nombreCompleto',e.target.value)}/>
                </div>
                <div>
                  {label('DNI')}
                  <input style={inputStyle} value={form.dni||''} onChange={e=>set('dni',e.target.value)} placeholder="12.345.678"/>
                </div>
              </>)}
              {grid2(<>
                <div>
                  {label('Usuario (login)')}
                  <input style={inputStyle} value={form.loginUser||''} onChange={e=>set('loginUser',e.target.value)}/>
                </div>
                <div>
                  {label('Contraseña')}
                  <input style={inputStyle} type="password" value={form.loginPass||''} onChange={e=>set('loginPass',e.target.value)} placeholder="••••••••"/>
                </div>
              </>)}
              {row(<>
                {label('Fecha de nacimiento')}
                <input style={inputStyle} type="date" value={form.fechaNac||''} onChange={e=>set('fechaNac',e.target.value)}/>
              </>)}
            </div>
          )}

          {/* ── COBROS / QR ── */}
          {tab==='cobros' && (
            <div>
              <div style={{ padding:'10px 14px', background:`${C.blue}12`, borderRadius:8, border:`1px solid ${C.blue}30`, marginBottom:16, fontSize:12, color:C.muted, lineHeight:1.6 }}>
                💡 <strong style={{ color:C.white }}>Cómo funciona:</strong> Cargá el alias o CVU de tu cuenta para que aparezca en facturas y presupuestos. Los QR de Mercado Pago y MODO se pueden vincular con la URL de tu QR de cobro.
              </div>

              <div style={{ fontWeight:700, color:C.subtle, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Transferencia bancaria</div>
              {grid2(<>
                <div>
                  {label('CBU / CVU')}
                  <input style={inputStyle} value={form.cbu||''} onChange={e=>set('cbu',e.target.value)} placeholder="0000003100014257688913"/>
                </div>
                <div>
                  {label('Alias')}
                  <input style={inputStyle} value={form.alias||''} onChange={e=>set('alias',e.target.value)} placeholder="ferreteria.plaza.mp"/>
                </div>
              </>)}

              <div style={{ fontWeight:700, color:C.subtle, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:10, marginTop:8 }}>Mercado Pago</div>
              {row(<>
                {label('Link de cobro (copiá tu link de pago de MP)')}
                <input style={inputStyle} value={form.mpLink||''} onChange={e=>set('mpLink',e.target.value)} placeholder="https://mpago.la/XXXXXXX"/>
              </>)}

              <div style={{ fontWeight:700, color:C.subtle, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>MODO</div>
              {row(<>
                {label('Link de cobro MODO')}
                <input style={inputStyle} value={form.modoLink||''} onChange={e=>set('modoLink',e.target.value)} placeholder="https://pagos.modo.com.ar/XXXXXXX"/>
              </>)}

              <div style={{ fontWeight:700, color:C.subtle, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Otros medios</div>
              {grid2(<>
                <div>
                  {label('Uala / Naranja X / otro')}
                  <input style={inputStyle} value={form.otroLink||''} onChange={e=>set('otroLink',e.target.value)} placeholder="Link o alias"/>
                </div>
                <div>
                  {label('Nombre (ej: otra billetera)')}
                  <input style={inputStyle} value={form.otroNombre||''} onChange={e=>set('otroNombre',e.target.value)}/>
                </div>
              </>)}

              <div style={{ marginTop:16, padding:'12px 14px', background:C.surface, borderRadius:8, border:`1px solid ${C.border}` }}>
                <div style={{ fontWeight:700, color:C.subtle, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                  🔌 Integración automática Mercado Pago
                </div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.8 }}>
                  Para recibir confirmación de pago <strong style={{color:C.white}}>en tiempo real</strong>, seguí estos pasos:
                </div>
                <ol style={{ fontSize:12, color:C.muted, lineHeight:2, paddingLeft:16, marginTop:6 }}>
                  <li>Con la app corriendo, abrí una terminal nueva</li>
                  <li>Ejecutá: <code style={{background:C.card,padding:'2px 6px',borderRadius:4,color:C.accent}}>npx ngrok http 3001</code></li>
                  <li>Copiá la URL https://xxxx.ngrok.io que te da</li>
                  <li>Entrá a MP Developers → Webhooks y pegá la URL + /api/mp/webhook</li>
                </ol>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                  Cuando un cliente pague con MP, verás una notificación 💙 en la barra superior.
                </div>
              </div>
            </div>
          )}

          {/* ── APP ── */}
          {tab==='app' && (
            <div>
              <div style={{ padding:'12px 16px', background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.white }}>Tema oscuro / claro</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Cambia el aspecto visual de toda la app</div>
                  </div>
                  <button onClick={()=>setDark(!dark)}
                    style={{ background: dark?C.accent:C.border, border:'none', borderRadius:20, width:44, height:24, cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
                    <div style={{ position:'absolute', top:3, left: dark?22:3, width:18, height:18, background:'#fff', borderRadius:'50%', transition:'left 0.2s' }}/>
                  </button>
                </div>
              </div>

              <div style={{ padding:'12px 16px', background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:10 }}>Cotización del dólar</div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
                  Se usa para convertir precios de productos cargados en USD. Actualizalo cuando cambie el tipo de cambio.
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:C.muted }}>USD 1 =</span>
                  <input style={{ ...inputStyle, width:120, fontFamily:'monospace', fontWeight:700 }}
                    type="number" value={form.cotizacionUSD||1200} onChange={e=>set('cotizacionUSD',+e.target.value)}/>
                  <span style={{ fontSize:12, color:C.muted }}>ARS</span>
                </div>
              </div>

              <div style={{ padding:'12px 16px', background:C.surface, borderRadius:10, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.white, marginBottom:6 }}>Acerca de</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>
                  <div>Ferretería Pro v5.4</div>
                  <div>by Zencio</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'16px 24px', borderTop:`1px solid ${C.border}` }}>
          <button style={s.btn('ghost')} onClick={onClose}>Cancelar</button>
          <button style={s.btn()} onClick={save}>💾 Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}
