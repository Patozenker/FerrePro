export const CATS_DEFAULT  = ["Herramientas","Fijaciones","Pinturas","Electricidad","Plomería","Madera","Adhesivos"]
export const CATS          = CATS_DEFAULT
export const ESTADOS_PEDIDO= ["pendiente","enviado","en_tránsito","recibido","cancelado"]
export const ESTADO_COLOR  = { pendiente:"#eab308", enviado:"#3b82f6", "en_tránsito":"#a855f7", recibido:"#22c55e", cancelado:"#ef4444" }
export const METODOS_PAGO  = ["transferencia","cheque","efectivo","tarjeta","débito"]
export const pieColors     = ["#f97316","#3b82f6","#22c55e","#eab308","#a855f7","#ec4899","#14b8a6"]
// ── VERSIÓN DE DATOS ─────────────────────────────────────────────────────────
// Al cambiar esta versión, App.jsx borra todos los datos operativos del
// localStorage y arranca limpio. Útil para romper con datos de demo.
export const DATA_VERSION  = "6.2-clean"
