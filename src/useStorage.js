import { useState, useEffect, useRef } from 'react'

export function getApiUrl() {
  if (typeof window === 'undefined') return ''
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isLocal ? 'http://localhost:3001' : ''
}

let _serverOk = null

function fetchWithTimeout(url, options = {}, ms = 800) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

async function pingServer() {
  if (_serverOk !== null) return _serverOk
  const dbUrl = getApiUrl()
  if (!dbUrl) {
    _serverOk = false
    return false
  }
  try {
    const r = await fetchWithTimeout(`${dbUrl}/api/ping`, {}, 800)
    _serverOk = r.ok
  } catch {
    _serverOk = false
    console.info('[DB] Servidor no disponible — usando localStorage')
  }
  return _serverOk
}

async function dbGet(key) {
  if (!(await pingServer())) return null
  const dbUrl = getApiUrl()
  if (!dbUrl) return null
  try {
    const r = await fetchWithTimeout(`${dbUrl}/api/data/${key}`, {}, 1500)
    const j = await r.json()
    return j.ok ? j.data : null
  } catch { return null }
}

async function dbSet(key, value) {
  if (_serverOk === false) return
  const dbUrl = getApiUrl()
  if (!dbUrl) return
  try {
    fetchWithTimeout(`${dbUrl}/api/data/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: value })
    }, 3000).catch(() => { _serverOk = false })
  } catch {}
}

export function useStorage(key, initialValue) {
  const fullKey   = `ferreteria_${key}`
  const firstSave = useRef(true)

  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(fullKey)
      if (stored === null) return initialValue
      const parsed = JSON.parse(stored)
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) return initialValue
      return parsed
    } catch {
      localStorage.removeItem(fullKey)
      return initialValue
    }
  })

  useEffect(() => {
    dbGet(key).then(serverData => {
      if (serverData !== null) {
        try { localStorage.setItem(fullKey, JSON.stringify(serverData)) } catch {}
        setValue(serverData)
      } else {
        try {
          const local = JSON.parse(localStorage.getItem(fullKey) || 'null')
          if (local !== null) dbSet(key, local)
        } catch {}
      }
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return }
    try {
      localStorage.setItem(fullKey, JSON.stringify(value))
    } catch {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('ferreteria_') && k !== fullKey)
          .slice(0, 3).forEach(k => localStorage.removeItem(k))
        localStorage.setItem(fullKey, JSON.stringify(value))
      } catch { console.warn('localStorage no disponible') }
    }
    dbSet(key, value)
  }, [value]) // eslint-disable-line

  return [value, setValue]
}

export function clearStorage() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('ferreteria_'))
    .forEach(k => localStorage.removeItem(k))
  sessionStorage.removeItem('ferreteria_session')
}
