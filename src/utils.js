export const fmt     = n  => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n||0)
export const fmtDate = d  => new Date(d+"T12:00").toLocaleDateString("es-AR")
export const nextId  = arr => Math.max(0,...arr.map(x=>x.id))+1

// ── Override global de fecha (para modo test) ─────────────────────────────
// App.jsx llama setDateOverride(str) cuando el usuario cambia la fecha test.
// Todos los componentes que usan today() o getNow() respetan el override.
let _dateOverride = null
export const setDateOverride = (d) => { _dateOverride = d || null }
export const today   = () => _dateOverride || new Date().toISOString().slice(0,10)
export const getNow  = () => _dateOverride ? new Date(_dateOverride + 'T12:00') : new Date()
