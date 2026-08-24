import { useEffect, useState } from "react"
import { useTheme } from "@/context/ThemeContext"

export interface ChartPalette {
  border: string
  muted: string
  surface: string
  heading: string
}

const LIGHT_PALETTE: ChartPalette = {
  border: "#e5e7eb",
  muted: "#64748b",
  surface: "#ffffff",
  heading: "#0f172a",
}

function readPalette(): ChartPalette {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback
  return {
    border: read("--color-border", LIGHT_PALETTE.border),
    muted: read("--color-muted", LIGHT_PALETTE.muted),
    surface: read("--color-surface", LIGHT_PALETTE.surface),
    heading: read("--color-heading", LIGHT_PALETTE.heading),
  }
}

export function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme()
  const [palette, setPalette] = useState<ChartPalette>(LIGHT_PALETTE)

  useEffect(() => {
    setPalette(readPalette())
  }, [resolvedTheme])

  return palette
}
