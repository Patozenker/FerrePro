import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function getApiUrl() {
  if (typeof window === 'undefined') return ''
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isLocal ? 'http://localhost:3001' : ''
}

// ── Supabase & API Data Layer ────────────────────────────────────────────────
async function fetchStore(key) {
  // 1. Intentar con Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('store')
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (!error && data && data.value !== undefined && data.value !== null) {
        return data.value
      }
    } catch (e) {
      console.warn(`[Supabase] Error leyendo ${key}:`, e)
    }
  }

  // 2. Intentar con Backend local si existe
  const apiUrl = getApiUrl()
  if (apiUrl) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1200)
      const r = await fetch(`${apiUrl}/api/data/${key}`, { signal: controller.signal })
      clearTimeout(timer)
      const j = await r.json()
      if (j.ok) return j.data
    } catch {}
  }

  return null
}

async function saveStore(key, value) {
  // 1. Guardar en Supabase
  if (supabase) {
    try {
      const { error } = await supabase
        .from('store')
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      if (error) {
        console.warn(`[Supabase] Error guardando ${key}:`, error.message)
      }
    } catch (e) {
      console.warn(`[Supabase] Error guardando ${key}:`, e)
    }
  }

  // 2. Guardar en Backend local si existe
  const apiUrl = getApiUrl()
  if (apiUrl) {
    try {
      fetch(`${apiUrl}/api/data/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: value })
      }).catch(() => {})
    } catch {}
  }
}

export function useStorage(key, initialValue) {
  const fullKey = `ferreteria_${key}`
  const isFirstSave = useRef(true)

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

  // Cargar datos iniciales desde Supabase / Backend y suscribirse a cambios en tiempo real
  useEffect(() => {
    let isMounted = true

    fetchStore(key).then(remoteData => {
      if (!isMounted) return
      if (remoteData !== null) {
        try { localStorage.setItem(fullKey, JSON.stringify(remoteData)) } catch {}
        setValue(remoteData)
      } else {
        // Si no existe en la nube pero tenemos datos en localStorage o iniciales, sincronizar a la nube
        try {
          const local = JSON.parse(localStorage.getItem(fullKey) || 'null')
          const dataToSeed = local !== null ? local : initialValue
          if (dataToSeed !== null && dataToSeed !== undefined) {
            saveStore(key, dataToSeed)
          }
        } catch {}
      }
    })

    // Suscripción Realtime con Supabase
    let channel = null
    if (supabase) {
      channel = supabase
        .channel(`public:store:${key}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'store', filter: `key=eq.${key}` },
          (payload) => {
            if (!isMounted) return
            const newVal = payload.new?.value
            if (newVal !== undefined && newVal !== null) {
              try { localStorage.setItem(fullKey, JSON.stringify(newVal)) } catch {}
              setValue(newVal)
            }
          }
        )
        .subscribe()
    }

    return () => {
      isMounted = false
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [key])

  // Guardar en localStorage y Supabase cuando cambia el valor
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false
      return
    }

    try {
      localStorage.setItem(fullKey, JSON.stringify(value))
    } catch {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('ferreteria_') && k !== fullKey)
          .slice(0, 3).forEach(k => localStorage.removeItem(k))
        localStorage.setItem(fullKey, JSON.stringify(value))
      } catch {}
    }

    saveStore(key, value)
  }, [value, key])

  return [value, setValue]
}

export function clearStorage() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('ferreteria_'))
    .forEach(k => localStorage.removeItem(k))
  sessionStorage.removeItem('ferreteria_session')
}
