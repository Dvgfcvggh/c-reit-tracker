"use client"

import { createContext, useContext, useLayoutEffect, useState } from "react"

export type ThemeName = "day" | "night"

const STORAGE_KEY = "reit-theme"

type ThemeContextValue = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "day",
  setTheme: () => {},
})

function readStoredTheme(): ThemeName | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "night" || stored === "day") return stored
  } catch {
    /* private mode */
  }
  return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("day")

  useLayoutEffect(() => {
    const next = readStoredTheme() ?? "day"
    setThemeState(next)
    document.documentElement.dataset.theme = next
  }, [])

  function setTheme(next: ThemeName) {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode */
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function overlayColor(theme: ThemeName, index: number): string {
  const colors =
    theme === "night"
      ? ["#7eb6ff", "#f5b942", "#c4b5fd", "#5eead4"]
      : ["#1d4e89", "#b45309", "#6d28d9", "#0f766e"]
  return colors[index % colors.length]
}

export function chartPalette(theme: ThemeName) {
  if (theme === "night") {
    return {
      up: "#ff4d4f",
      down: "#1dbf73",
      background: "#10161c",
      text: "#c5ced6",
      grid: "rgba(197,206,214,0.08)",
      border: "rgba(197,206,214,0.16)",
      volumeUp: "rgba(255,77,79,0.45)",
      volumeDown: "rgba(29,191,115,0.45)",
      volumeNeutral: "rgba(197,206,214,0.35)",
    }
  }
  return {
    up: "#d92d20",
    down: "#067647",
    background: "#ffffff",
    text: "#3f3a33",
    grid: "rgba(28,25,21,0.08)",
    border: "rgba(28,25,21,0.16)",
    volumeUp: "rgba(217,45,32,0.45)",
    volumeDown: "rgba(6,118,71,0.45)",
    volumeNeutral: "rgba(28,25,21,0.28)",
  }
}
