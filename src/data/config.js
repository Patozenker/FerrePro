export const CATS_DEFAULT  = ["Herramientas","Fijaciones","Pinturas","Electricidad","Plomería","Madera","Adhesivos"]
export const CATS          = CATS_DEFAULT

export const FAMILIAS_PRINCIPALES = [
  {
    id: "pinturas",
    nombre: "Pinturería",
    icono: "🎨",
    keywords: [
      "pintur", "latex", "látex", "esmalte", "barniz", "barnic", "impregnan", "pincel", "brocha",
      "rodillo", "diluyen", "aguarras", "aguarrás", "thinner", "impermeabil", "membran", "antihumedad",
      "revestimien", "tizada", "cielorras", "fondo", "sellador", "enduido", "masilla", "removedor",
      "antioxido", "antióxido", "convertidor", "al agua", "sintetico", "sintético", "entonador",
      "techo", "frente", "ladrillo", "tapa gotera", "epoxi", "poliuretano", "hidrorepelente", "pila", "muresco", "madera"
    ]
  },
  {
    id: "herramientas",
    nombre: "Herramientas y Máquinas",
    icono: "🔨",
    keywords: [
      "herramient", "amolador", "taladro", "sierra", "soldador", "atornilla", "hidrolavador", "lijador",
      "lija", "disco", "abrasiv", "esmeril", "llave", "destornill", "tubo", "pinza", "martillo", "pala",
      "fratacho", "carretilla", "cortador", "motosierra", "desmalezador", "bocallave", "sargento", "nivel",
      "cinta métrica", "cepillo alambre", "escuadra", "morsa", "caja de herram", "maquinas", "máquinas"
    ]
  },
  {
    id: "seguridad",
    nombre: "Seguridad y Vigilancia",
    icono: "🛡️",
    keywords: [
      "seguridad", "alarma", "camara", "cámara", "dvr", "nvr", "sensor", "cerco", "electrific",
      "acceso", "video", "bnc", "rca", "balun", "portero", "cerradura", "sirena", "vigilancia",
      "infrarrojo", "grabador", "intercom", "conector video", "fuente camara"
    ]
  },
  {
    id: "electricidad",
    nombre: "Electricidad e Iluminación",
    icono: "⚡",
    keywords: [
      "electr", "cable", "iluminac", "iluminación", "lampara", "lámpara", "foco", "spot", "led", "termica", "térmica",
      "disyuntor", "enchufe", "toma", "interruptor", "tablero", "fotocelula", "fotocélula", "cable canal",
      "alargue", "zapatilla", "borne", "portalámpara", "aplique", "proyector", "panel led"
    ]
  },
  {
    id: "plomeria",
    nombre: "Plomería y Agua",
    icono: "🚰",
    keywords: [
      "plomer", "caño", "tubo pvc", "grifer", "bomba", "tanque", "valvula", "válvula", "canilla",
      "termofusion", "termofusión", "sifón", "descarga", "flexible", "flotante", "presurizadora",
      "desagüe", "rejilla", "llave de paso", "cople", "cupla", "codo pvc", "te pvc", "agua"
    ]
  },
  {
    id: "construccion",
    nombre: "Construcción y Fijaciones",
    icono: "🧱",
    keywords: [
      "construcc", "fijacion", "fijación", "tornill", "tarugo", "bulon", "bulón", "clavo", "chapa",
      "perfil", "solera", "montante", "durlock", "yeso", "cemento", "adhesivo", "pegamento",
      "silicona", "espuma", "membrana asfalt", "malla", "viga", "hierro", "arena", "cal", "anclaje",
      "escuadra fijac", "tuerca", "arandela", "varilla roscada"
    ]
  },
  {
    id: "automotor",
    nombre: "Automotor",
    icono: "🚗",
    keywords: [
      "automotor", "autopolish", "cera auto", "shampoo auto", "batería auto", "pulidora auto",
      "refrigerante", "limpia parabrisas", "lubricante auto", "aceite motor", "cargador bateria", "chapa y pintura"
    ]
  },
  {
    id: "hogar",
    nombre: "Hogar, Jardín y Varios",
    icono: "🏡",
    keywords: [
      "hogar", "jardin", "jardín", "bazar", "limpieza", "pileta", "climatiz", "ventilad", "calefacc",
      "estufa", "termo", "conservador", "camping", "escalera", "mesa", "silla", "mueble", "bano", "baño",
      "cocina", "extractor", "aspiradora", "tostadora", "anafe", "riego", "manguera", "parrilla"
    ]
  },
  {
    id: "otros",
    nombre: "Otros Rubros",
    icono: "📦",
    keywords: []
  }
]

export function esCategoriaBasura(nombre) {
  if (!nombre || typeof nombre !== "string") return true
  const n = nombre.trim().toLowerCase()
  if (n.length < 2 || n.length > 45) return true
  if (n.endsWith(".html") || n.includes(".html") || n.includes("http") || n.includes("www.") || n.includes("brand=") || n.includes("referer")) return true
  if (n.includes("% off") || n.includes("megaoferta") || n.includes("outlet") || n.includes("lo mas vendido") || n.includes("lo más vendido") || n.includes("productos destacados") || n.includes("por marca") || n.includes("por color") || n.includes("por producto") || n.includes("elegí tu color") || n.includes("blancos naturales") || n.includes("recubrimiento especial")) return true
  if (/^\d+\s*(lts?|lt|litros?|kg|grs?|mm|cm|mts?|m)\b/i.test(n) || /^\d+\s*x\s*\d+/i.test(n)) return true
  if (/^\d+\s*lts?\s*(sw|blanco|rojo|azul|verde|amarillo)/i.test(n)) return true
  return false
}

export function clasificarEnFamilia(categoria) {
  if (!categoria || typeof categoria !== "string") return FAMILIAS_PRINCIPALES.find(f => f.id === "otros")
  const c = categoria.trim().toLowerCase()

  for (const fam of FAMILIAS_PRINCIPALES) {
    if (fam.id === "otros") continue
    if (fam.keywords.some(k => c.includes(k))) {
      return fam
    }
  }
  return FAMILIAS_PRINCIPALES.find(f => f.id === "otros")
}

export const ESTADOS_PEDIDO= ["pendiente","enviado","en_tránsito","recibido","cancelado"]
export const ESTADO_COLOR  = { pendiente:"#eab308", enviado:"#3b82f6", "en_tránsito":"#a855f7", recibido:"#22c55e", cancelado:"#ef4444" }
export const METODOS_PAGO  = ["transferencia","cheque","efectivo","tarjeta","débito"]
export const pieColors     = ["#f97316","#3b82f6","#22c55e","#eab308","#a855f7","#ec4899","#14b8a6"]
// ── VERSIÓN DE DATOS ─────────────────────────────────────────────────────────
// Al cambiar esta versión, App.jsx borra todos los datos operativos del
// localStorage y arranca limpio. Útil para romper con datos de demo.
export const DATA_VERSION  = "6.6-caudal"

