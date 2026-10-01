/**
 * The line-layer theme: the CSS custom properties that drive BOTH line layers.
 *
 * The SVG layer gets them through the stylesheet (static/nodditor.css turns them into
 * `stroke` / `stroke-width`), and the canvas layer — which cannot use CSS — reads the
 * resolved values and parses them. A host therefore themes both layers by setting
 * variables instead of matching the library's hard-coded constants.
 *
 * | variable                | default   | what it drives                                        |
 * | ----------------------- | --------- | ----------------------------------------------------- |
 * | `--ne-line-color`       | `#000`    | the base stroke                                       |
 * | `--ne-line-selected`    | `#2ea7a7` | a selected line                                       |
 * | `--ne-line-from-sel`    | `#bfc233` | a line whose SOURCE block is selected                 |
 * | `--ne-line-to-sel`      | `#2e6ca7` | a line whose TARGET block is selected                 |
 * | `--ne-line-width`       | `2px`     | stroke width in CSS px (zoom independent)             |
 * | `--ne-line-hit-width`   | `8px`     | the invisible hit stroke; the canvas pick band is HALF of it |
 *
 * ONE thing the variables cannot express: the precedence between the three selection
 * states (to-sel > from-sel > selected > base). In the SVG layer that is the ORDER OF
 * THE RULES in static/nodditor.css, and the canvas layer repeats it in `stateOf()`.
 * Keep the two in step when adding a state.
 *
 * Values are read with `getComputedStyle`, so they resolve exactly as the stylesheet
 * makes them resolve — including inheritance from an ancestor (a host may set them on
 * `body`), which is why they are read off the editor element and not from a lookup of
 * its own inline style. Anything that cannot be parsed falls back to the default
 * below, so a typo in a theme degrades to the library look instead of a black line.
 */

/**
 * The fallbacks, already parsed. These are what an app that does NOT load
 * static/nodditor.css gets, and they mirror the defaults declared in that file.
 *
 * @type {{base: number[], selected: number[], fromSel: number[], toSel: number[], widthCss: number, hitWidthCss: number}}
 */
export const LINE_THEME_DEFAULTS = {
  base: [0, 0, 0, 1],
  selected: [46 / 255, 167 / 255, 167 / 255, 1], // #2ea7a7
  fromSel: [191 / 255, 194 / 255, 51 / 255, 1], // #bfc233
  toSel: [46 / 255, 108 / 255, 167 / 255, 1], // #2e6ca7
  widthCss: 2,
  hitWidthCss: 8,
}

/** The handful of colour keywords a hand-written theme is likely to use. */
const NAMED_COLORS = {
  black: [0, 0, 0, 1],
  white: [1, 1, 1, 1],
  red: [1, 0, 0, 1],
  green: [0, 128 / 255, 0, 1],
  blue: [0, 0, 1, 1],
  yellow: [1, 1, 0, 1],
  orange: [1, 165 / 255, 0, 1],
  purple: [128 / 255, 0, 128 / 255, 1],
  gray: [128 / 255, 128 / 255, 128 / 255, 1],
  grey: [128 / 255, 128 / 255, 128 / 255, 1],
  transparent: [0, 0, 0, 0],
}

/**
 * Parse a CSS colour into `[r, g, b, a]` with 0..1 components, or `null` when the
 * value is not one of the supported forms.
 *
 * Supported: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` / `rgba()` with commas
 * or spaces (and the `rgb(r g b / a)` form), percentages for the channels, and the
 * keywords in `NAMED_COLORS`. Everything else (hsl, color-mix, ...) returns `null` so
 * the caller can fall back — resolving arbitrary CSS colours would need a layout
 * engine, and `getComputedStyle(...).stroke` is not a normaliser in every environment
 * this runs in (happy-dom returns the literal value).
 *
 * @param {string} value
 * @returns {number[]|null}
 */
export const parseCssColor = value => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return null
  if (raw in NAMED_COLORS) return NAMED_COLORS[raw].slice()
  if (raw.startsWith('#')) {
    const hex = raw.slice(1)
    if (!/^[0-9a-f]+$/.test(hex)) return null
    if (hex.length === 3 || hex.length === 4) {
      const v = [...hex].map(c => parseInt(c + c, 16) / 255)
      return [v[0], v[1], v[2], hex.length === 4 ? v[3] : 1]
    }
    if (hex.length === 6 || hex.length === 8) {
      const v = []
      for (let i = 0; i < hex.length; i += 2) v.push(parseInt(hex.slice(i, i + 2), 16) / 255)
      return [v[0], v[1], v[2], hex.length === 8 ? v[3] : 1]
    }
    return null
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(raw)
  if (!fn) return null
  const parts = fn[1]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(s => s.length)
  if (parts.length < 3 || parts.length > 4) return null
  const channel = s => {
    const pct = s.endsWith('%')
    const n = parseFloat(pct ? s : s)
    if (!Number.isFinite(n)) return null
    return pct ? n / 100 : n / 255
  }
  const r = channel(parts[0])
  const g = channel(parts[1])
  const b = channel(parts[2])
  const a = parts.length === 4 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1
  if (r === null || g === null || b === null || !Number.isFinite(a)) return null
  return [r, g, b, a]
}

/**
 * A positive CSS length in px (a bare number is taken as px). Anything else — an empty
 * variable, a negative or zero width, a non-numeric value — falls back.
 *
 * @param {string} value
 * @param {number} fallback
 * @returns {number}
 */
export const parseCssLength = (value, fallback) => {
  const n = parseFloat(String(value ?? '').trim())
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Read the resolved theme off an element (custom properties inherit, so the editor
 * element sees whatever an ancestor set).
 *
 * @param {Element} el
 * @param {typeof LINE_THEME_DEFAULTS} [defaults]
 * @returns {typeof LINE_THEME_DEFAULTS}
 */
export const readLineTheme = (el, defaults = LINE_THEME_DEFAULTS) => {
  const style = typeof getComputedStyle == 'function' ? getComputedStyle(el) : null
  const variable = name => (style?.getPropertyValue(name) ?? '').trim()
  return {
    base: parseCssColor(variable('--ne-line-color')) ?? defaults.base.slice(),
    selected: parseCssColor(variable('--ne-line-selected')) ?? defaults.selected.slice(),
    fromSel: parseCssColor(variable('--ne-line-from-sel')) ?? defaults.fromSel.slice(),
    toSel: parseCssColor(variable('--ne-line-to-sel')) ?? defaults.toSel.slice(),
    widthCss: parseCssLength(variable('--ne-line-width'), defaults.widthCss),
    hitWidthCss: parseCssLength(variable('--ne-line-hit-width'), defaults.hitWidthCss),
  }
}
