export function makeColors(dark = true) {
  if (dark) return {
    bg:"#080b12", surface:"#0f1320", card:"#161c2e", border:"#1f2840",
    accent:"#f97316", accentDim:"rgba(249,115,22,0.12)",
    blue:"#3b82f6", green:"#22c55e", yellow:"#eab308", red:"#ef4444", purple:"#a855f7",
    text:"#e2e8f0", muted:"#4a5568", subtle:"#8896a7", white:"#f8fafc",
    inputBg:"#0f1320", rowHover:"#0f1320", chartGrid:"#1f2840",
  }
  return {
    bg:"#f1f5f9", surface:"#ffffff", card:"#ffffff", border:"#e2e8f0",
    accent:"#ea6c00", accentDim:"rgba(234,108,0,0.08)",
    blue:"#2563eb", green:"#16a34a", yellow:"#b45309", red:"#dc2626", purple:"#9333ea",
    text:"#1e293b", muted:"#94a3b8", subtle:"#64748b", white:"#0f172a",
    inputBg:"#f8fafc", rowHover:"#f8fafc", chartGrid:"#e2e8f0",
  }
}

export function makeStyles(C) {
  return {
    app:     { display:"flex", height:"100vh", background:C.bg, color:C.text, fontFamily:"'IBM Plex Sans',system-ui,sans-serif", overflow:"hidden" },
    sidebar: { width:224, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0 },
    nav:     { flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:2 },
    navItem: a => ({ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:a?600:400, background:a?C.accentDim:"transparent", color:a?C.accent:C.subtle, border:`1px solid ${a?"rgba(249,115,22,0.25)":"transparent"}`, width:"100%", textAlign:"left" }),
    main:    { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
    topbar:  { height:56, background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 24px", gap:12, flexShrink:0 },
    content: { flex:1, overflow:"auto", padding:24 },
    card:    { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20 },
    badge:   color => ({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:`${color}22`, color }),
    btn:     (v="primary") => ({ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
               background: v==="primary"?C.accent:v==="danger"?`${C.red}22`:v==="green"?`${C.green}22`:v==="blue"?C.blue:v==="purple"?`${C.purple}22`:C.border,
               color:      v==="primary"?"#fff":v==="danger"?C.red:v==="green"?C.green:v==="blue"?"#fff":v==="purple"?C.purple:C.subtle }),
    input:   { width:"100%", background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontSize:13, outline:"none", boxSizing:"border-box" },
    label:   { fontSize:12, color:C.subtle, fontWeight:500, marginBottom:4, display:"block" },
    table:   { width:"100%", borderCollapse:"collapse", fontSize:13 },
    th:      { padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:1, borderBottom:`1px solid ${C.border}` },
    td:      { padding:"11px 14px", borderBottom:`1px solid ${C.border}`, color:C.text },
    modal:   { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" },
    grid:    c => ({ display:"grid", gridTemplateColumns:`repeat(${c},1fr)`, gap:16 }),
    kpi:     { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, display:"flex", flexDirection:"column", gap:8 },
    tab:     a => ({ padding:"7px 14px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:a?C.accentDim:"transparent", color:a?C.accent:C.muted }),
    pill:    a => ({ padding:"5px 14px", borderRadius:20, border:`1px solid ${a?C.accent:C.border}`, background:a?C.accentDim:"transparent", color:a?C.accent:C.subtle, cursor:"pointer", fontSize:12, fontWeight:a?600:400, whiteSpace:"nowrap" }),
  }
}
