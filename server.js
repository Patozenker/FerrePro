import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require    = createRequire(import.meta.url)
const initSqlJs  = require('sql.js')
const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE    = path.join(__dirname, 'src', 'data', 'db', 'ferreteria.db')
const SEED_DIR   = path.join(__dirname, 'src', 'data', 'seed')
const PORT       = 3001

// Ensure DB directory exists
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })

let db  = null   // sql.js Database instance
let SQL = null   // sql.js constructor

// ── Init SQLite ──────────────────────────────────────────────────────────────
async function initDB() {
  SQL = await initSqlJs()
  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE)
    db = new SQL.Database(buf)
    console.log('  📂  Loaded existing DB from', DB_FILE)
  } else {
    db = new SQL.Database()
    console.log('  🆕  Created new DB at', DB_FILE)
  }
  // Create store table
  db.run(`CREATE TABLE IF NOT EXISTS store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
  saveDB()

  // Seed default data if empty
  const keys = ['productos','clientes','proveedores','ventas','pedidos','pagos','historialPrecios','descuentos','categoriasExtra','pagosServicios','configAdmin']
  for (const key of keys) {
    const exists = db.exec(`SELECT 1 FROM store WHERE key='${key}'`)
    if (!exists.length || !exists[0].values.length) {
      const seedFile = path.join(SEED_DIR, `${key}.json`)
      if (fs.existsSync(seedFile)) {
        const data = fs.readFileSync(seedFile, 'utf8')
        db.run('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)', [key, data])
        console.log(`  🌱  Seeded: ${key}`)
      }
    }
  }
  saveDB()
}

function saveDB() {
  const data = db.export()
  fs.writeFileSync(DB_FILE, Buffer.from(data))
}

function parsePrecioSQLite(raw) {
  if (raw === null || raw === undefined || raw === '') return 0
  const s = String(raw).trim()
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (s.includes(',')) {
    const parts = s.split(',')
    return Number(parts.length === 2 && parts[1].length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '')) || 0
  }
  if (s.includes('.')) {
    const parts = s.split('.')
    return Number(parts.length === 2 && parts[1].length === 3 ? s.replace(/\./g, '') : s.replace(/,/g, '')) || 0
  }
  return Number(s.replace(/[^0-9.-]/g, '')) || 0
}

function syncProductosFromTable() {
  try {
    const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='productos'")
    if (!tableCheck.length || !tableCheck[0].values.length) return []

    const result = db.exec(`
      SELECT rowid, url_origen, rubro, producto, codigo, moneda, precio_actual, precio_anterior, estado_cambio, ultima_actualizacion
      FROM productos
      ORDER BY producto
    `)

    if (!result.length) return []

    const items = result[0].values.map((values) => {
      const [rowid, url_origen, rubro, producto, codigo, moneda, precio_actual] = values
      const costo = parsePrecioSQLite(precio_actual)
      return {
        id: rowid,
        sku: (codigo && String(codigo).trim() && String(codigo).trim() !== 'N/A') ? String(codigo).trim() : `SCR-${String(rowid).padStart(4, '0')}`,
        nombre: producto || 'Sin nombre',
        cat: rubro || 'General',
        cats: rubro ? [rubro] : ['General'],
        costo,
        margen: 0,
        venta: costo || 0,
        stock: 0,
        minStock: 2,
        provId: 1,
        foto: '',
        moneda: moneda || 'ARS',
        ivaTasa: 21,
        ivaIncluido: true,
        _source: 'scrape',
      }
    })

    db.run("INSERT OR REPLACE INTO store (key, value, updated_at) VALUES (?, ?, datetime('now'))", ['productos', JSON.stringify(items)])
    saveDB()
    return items
  } catch (e) {
    console.error('syncProductosFromTable failed:', e)
    return []
  }
}

// ── Express ──────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '100mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.get('/api/ping', (_, res) => res.json({ ok: true }))

app.get('/api/data/:key', (req, res) => {
  const key = req.params.key.replace(/[^a-zA-Z0-9_-]/g, '')
  try {
    if (key === 'productos') {
      const synced = syncProductosFromTable()
      if (synced.length) {
        return res.json({ ok: true, data: synced })
      }
    }

    const result = db.exec('SELECT value FROM store WHERE key = ?', [key])
    if (!result.length || !result[0].values.length) return res.json({ ok: false, data: null })
    res.json({ ok: true, data: JSON.parse(result[0].values[0][0]) })
  } catch (e) {
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/data/:key', (req, res) => {
  const key = req.params.key.replace(/[^a-zA-Z0-9_-]/g, '')
  try {
    db.run('INSERT OR REPLACE INTO store (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))', [key, JSON.stringify(req.body.data)])
    saveDB()
    res.json({ ok: true })
  } catch (e) {
    res.json({ ok: false, error: e.message })
  }
})

// Reset: delete keys from store (seed reloads on next GET)
app.post('/api/reset', (req, res) => {
  try {
    const keys = req.body.keys || []
    if (keys.length > 0) {
      keys.forEach(k => db.run('DELETE FROM store WHERE key = ?', [k]))
    } else {
      db.run("DELETE FROM store WHERE key NOT IN ('configAdmin')")
    }
    saveDB()
    res.json({ ok: true })
  } catch (e) {
    res.json({ ok: false, error: e.message })
  }
})

// MP Webhook
app.post('/api/mp/webhook', (req, res) => {
  const { type, data } = req.body || {}
  if (type === 'payment' && data?.id) {
    try {
      const existing = db.exec("SELECT value FROM store WHERE key='mp_notifs'")
      const notifs = existing.length && existing[0].values.length
        ? JSON.parse(existing[0].values[0][0]) : []
      notifs.push({ id: data.id, fecha: new Date().toISOString(), estado: 'pending', raw: req.body })
      db.run('INSERT OR REPLACE INTO store (key,value) VALUES (?,?)', ['mp_notifs', JSON.stringify(notifs.slice(-50))])
      saveDB()
    } catch {}
  }
  res.sendStatus(200)
})

app.get('/api/mp/notifs', (_, res) => {
  try {
    const r = db.exec("SELECT value FROM store WHERE key='mp_notifs'")
    const data = r.length && r[0].values.length ? JSON.parse(r[0].values[0][0]) : []
    res.json({ ok: true, data })
  } catch { res.json({ ok: true, data: [] }) }
})

app.post('/api/mp/notifs/:id/done', (req, res) => {
  try {
    const r = db.exec("SELECT value FROM store WHERE key='mp_notifs'")
    if (r.length && r[0].values.length) {
      let notifs = JSON.parse(r[0].values[0][0])
      notifs = notifs.map(n => n.id === req.params.id ? { ...n, estado: 'procesada' } : n)
      db.run('INSERT OR REPLACE INTO store (key,value) VALUES (?,?)', ['mp_notifs', JSON.stringify(notifs)])
      saveDB()
    }
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

// Start
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('')
    console.log('  ✅  Ferretería Pro v6.0 — SQLite Server')
    console.log(`  🗄️   DB:    ${DB_FILE}`)
    console.log(`  🌐  API:   http://localhost:${PORT}`)
    console.log('')
  })
}).catch(e => { console.error('DB init failed:', e); process.exit(1) })
