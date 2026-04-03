export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(hex: string) {
  const safe = String(hex || "").trim()
  const normalized = safe.startsWith('#') ? safe.slice(1) : safe
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => `${char}${char}`).join('') : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return { r: 255, g: 255, b: 255 }
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

export function buildPanelTheme(panelOpacity: number, panelColor = '#ffffff') {
  const base = clamp(panelOpacity, 0, 1)
  const { r, g, b } = parseHexColor(panelColor)
  const rgba = (alpha: number) => `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`

  return {
    root: rgba(base * 0.88 + 0.08),
    strong: rgba(base * 0.82 + 0.12),
    card: rgba(base * 0.68 + 0.12),
    muted: rgba(base * 0.48 + 0.12),
    rail: rgba(base * 0.34 + 0.18),
    border: rgba(0.16 + base * 0.34),
    blurClass: base <= 0.01 ? "" : "backdrop-blur-xl",
  }
}
