import React, { createContext, useContext, useState } from 'react'
import { makeColors, makeStyles } from './theme'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true)
  const C = makeColors(dark)
  const s = makeStyles(C)
  return (
    <ThemeCtx.Provider value={{ dark, setDark, C, s }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeCtx)
}
