export const initVentas = [
  // ── HOY (26/08) ──
  {
    id: 1,
    fecha: "2026-08-26",
    hora: "11:15",
    clienteId: 0,
    items: [
      { prodId: 2, qty: 1, precio: 63000, descuento: 0 },
      { prodId: 6, qty: 1, precio: 13940, descuento: 0 }
    ],
    total: 76940,
    tipo: "venta",
    estado: "completada",
    formaPago: "tarjeta",
    nota: "Venta mostrador"
  },
  {
    id: 2,
    fecha: "2026-08-26",
    hora: "15:30",
    clienteId: 4,
    items: [
      { prodId: 23, qty: 2, precio: 9360, descuento: 0 },
      { prodId: 22, qty: 3, precio: 1800, descuento: 0 }
    ],
    total: 24120,
    tipo: "venta",
    estado: "completada",
    formaPago: "efectivo",
    nota: "Mostrador"
  },

  // ── ESTA SEMANA (20/08 a 25/08) ──
  {
    id: 3,
    fecha: "2026-08-25",
    hora: "17:30",
    clienteId: 5,
    items: [
      { prodId: 20, qty: 6, precio: 11560, descuento: 8 },
      { prodId: 21, qty: 3, precio: 14280, descuento: 8 },
      { prodId: 22, qty: 5, precio: 1800, descuento: 8 }
    ],
    total: 111504,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Instalación sanitaria"
  },
  {
    id: 4,
    fecha: "2026-08-24",
    hora: "10:50",
    clienteId: 4,
    items: [
      { prodId: 23, qty: 1, precio: 9360, descuento: 0 },
      { prodId: 21, qty: 1, precio: 14280, descuento: 0 }
    ],
    total: 23640,
    tipo: "venta",
    estado: "completada",
    formaPago: "cuenta_corriente",
    nota: "Reparación baño"
  },
  {
    id: 5,
    fecha: "2026-08-23",
    hora: "16:05",
    clienteId: 3,
    items: [
      { prodId: 11, qty: 2, precio: 81000, descuento: 0 },
      { prodId: 12, qty: 2, precio: 39200, descuento: 0 },
      { prodId: 13, qty: 3, precio: 5220, descuento: 0 }
    ],
    total: 256060,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Pintura oficinas"
  },
  {
    id: 6,
    fecha: "2026-08-22",
    hora: "14:20",
    clienteId: 0,
    items: [
      { prodId: 4, qty: 1, precio: 15200, descuento: 0 },
      { prodId: 5, qty: 1, precio: 7650, descuento: 0 }
    ],
    total: 22850,
    tipo: "venta",
    estado: "completada",
    formaPago: "debito",
    nota: ""
  },
  {
    id: 7,
    fecha: "2026-08-21",
    hora: "11:40",
    clienteId: 2,
    items: [
      { prodId: 15, qty: 1, precio: 57000, descuento: 5 },
      { prodId: 17, qty: 4, precio: 13260, descuento: 5 }
    ],
    total: 104681,
    tipo: "venta",
    estado: "completada",
    formaPago: "efectivo",
    nota: "Descuento electricista"
  },
  {
    id: 8,
    fecha: "2026-08-20",
    hora: "09:15",
    clienteId: 1,
    items: [
      { prodId: 1, qty: 1, precio: 72000, descuento: 10 },
      { prodId: 7, qty: 3, precio: 20000, descuento: 10 }
    ],
    total: 118800,
    tipo: "venta",
    estado: "completada",
    formaPago: "cuenta_corriente",
    nota: "Entrega Olivos"
  },

  // ── SEMANAS ANTERIORES DE AGOSTO (S1 y S2) ──
  {
    id: 9,
    fecha: "2026-08-12",
    hora: "10:30",
    clienteId: 1,
    items: [
      { prodId: 7, qty: 5, precio: 20000, descuento: 10 },
      { prodId: 8, qty: 5, precio: 17600, descuento: 10 },
      { prodId: 9, qty: 10, precio: 5760, descuento: 10 }
    ],
    total: 220140,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Materiales durlock"
  },
  {
    id: 10,
    fecha: "2026-08-05",
    hora: "16:45",
    clienteId: 3,
    items: [
      { prodId: 11, qty: 3, precio: 81000, descuento: 0 },
      { prodId: 14, qty: 4, precio: 8640, descuento: 0 }
    ],
    total: 277560,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Látex exterior e interior"
  },

  // ── MESES ANTERIORES DE 2026 (Julio, Junio, Mayo, Abril) ──
  {
    id: 11,
    fecha: "2026-07-22",
    hora: "11:00",
    clienteId: 1,
    items: [
      { prodId: 1, qty: 2, precio: 72000, descuento: 10 },
      { prodId: 3, qty: 2, precio: 44800, descuento: 10 }
    ],
    total: 210240,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Herramientas de mano"
  },
  {
    id: 12,
    fecha: "2026-07-10",
    hora: "14:15",
    clienteId: 2,
    items: [
      { prodId: 15, qty: 2, precio: 57000, descuento: 5 },
      { prodId: 16, qty: 2, precio: 57000, descuento: 5 },
      { prodId: 18, qty: 2, precio: 35200, descuento: 5 }
    ],
    total: 283480,
    tipo: "venta",
    estado: "completada",
    formaPago: "efectivo",
    nota: "Instalación tablero"
  },
  {
    id: 13,
    fecha: "2026-06-18",
    hora: "15:20",
    clienteId: 5,
    items: [
      { prodId: 20, qty: 10, precio: 11560, descuento: 8 },
      { prodId: 21, qty: 5, precio: 14280, descuento: 8 }
    ],
    total: 172040,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Cañería termofusión"
  },
  {
    id: 14,
    fecha: "2026-05-14",
    hora: "10:10",
    clienteId: 3,
    items: [
      { prodId: 11, qty: 4, precio: 81000, descuento: 0 },
      { prodId: 12, qty: 4, precio: 39200, descuento: 0 }
    ],
    total: 480800,
    tipo: "venta",
    estado: "completada",
    formaPago: "transferencia",
    nota: "Pinturas edificio"
  },
  {
    id: 15,
    fecha: "2026-04-20",
    hora: "12:00",
    clienteId: 1,
    items: [
      { prodId: 2, qty: 2, precio: 63000, descuento: 10 },
      { prodId: 6, qty: 3, precio: 13940, descuento: 10 }
    ],
    total: 151038,
    tipo: "venta",
    estado: "completada",
    formaPago: "cuenta_corriente",
    nota: "Herramientas de corte"
  }
]
