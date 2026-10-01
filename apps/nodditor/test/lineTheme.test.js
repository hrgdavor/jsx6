/**
 * The line-layer theme: how a CSS colour / length from a `--ne-line-*` variable becomes
 * the `[r, g, b, a]` array and the pixel numbers the WebGPU canvas layer needs.
 *
 * The styling contract itself (which variables exist, what they drive) is the
 * `lineTheme.js` header and the `static/nodditor.css` rules; this file pins the
 * PARSING, which is the part that has to stay predictable across environments — there is
 * no layout engine to normalise a colour in every runtime the layer runs in, so the
 * supported forms are explicit and anything else falls back to the library default.
 */
import './setup.js'

import { expect, test } from 'bun:test'

import { LINE_THEME_DEFAULTS, parseCssColor, parseCssLength, readLineTheme } from '../src/lineTheme.js'

test('parseCssColor reads the hex forms, short and long, with and without alpha', () => {
  expect(parseCssColor('#000')).toEqual([0, 0, 0, 1])
  expect(parseCssColor('#fff')).toEqual([1, 1, 1, 1])
  expect(parseCssColor('#ff0000')).toEqual([1, 0, 0, 1])
  expect(parseCssColor('#2ea7a7')).toEqual([46 / 255, 167 / 255, 167 / 255, 1])
  // 4- and 8-digit hex carry alpha
  expect(parseCssColor('#f00f')).toEqual([1, 0, 0, 1])
  expect(parseCssColor('#ff000080')[3]).toBeCloseTo(128 / 255)
  // case and whitespace do not matter
  expect(parseCssColor('  #FF0000  ')).toEqual([1, 0, 0, 1])
})

test('parseCssColor reads rgb()/rgba(), comma or space syntax, with percentages', () => {
  expect(parseCssColor('rgb(255, 0, 0)')).toEqual([1, 0, 0, 1])
  expect(parseCssColor('rgb(255 0 0)')).toEqual([1, 0, 0, 1])
  expect(parseCssColor('rgba(0, 0, 255, 0.5)')).toEqual([0, 0, 1, 0.5])
  expect(parseCssColor('rgb(0 0 255 / 0.25)')).toEqual([0, 0, 1, 0.25])
  expect(parseCssColor('rgb(100%, 0%, 50%)')).toEqual([1, 0, 0.5, 1])
  expect(parseCssColor('rgba(10,20,30,50%)')).toEqual([10 / 255, 20 / 255, 30 / 255, 0.5])
})

test('parseCssColor knows the handful of keywords a hand-written theme uses', () => {
  expect(parseCssColor('black')).toEqual([0, 0, 0, 1])
  expect(parseCssColor('white')).toEqual([1, 1, 1, 1])
  expect(parseCssColor('transparent')).toEqual([0, 0, 0, 0])
  expect(parseCssColor('RED')).toEqual([1, 0, 0, 1])
})

test('parseCssColor returns null for what it cannot resolve (and never guesses)', () => {
  expect(parseCssColor('')).toBeNull()
  expect(parseCssColor('hsl(200 50% 50%)')).toBeNull()
  expect(parseCssColor('color-mix(in srgb, red, blue)')).toBeNull()
  expect(parseCssColor('#12345')).toBeNull()
  expect(parseCssColor('rgb(1, 2)')).toBeNull()
  expect(parseCssColor('rebeccapurple')).toBeNull() // a keyword outside the table
})

test('parseCssLength takes a positive px length and rejects the rest', () => {
  expect(parseCssLength('2px', 99)).toBe(2)
  expect(parseCssLength('2.5px', 99)).toBe(2.5)
  expect(parseCssLength(' 4 ', 99)).toBe(4) // a bare number is px
  expect(parseCssLength('', 99)).toBe(99)
  expect(parseCssLength('0px', 99)).toBe(99) // an invisible line is a bug, not a theme
  expect(parseCssLength('-2px', 99)).toBe(99)
  expect(parseCssLength('wide', 99)).toBe(99)
})

test('readLineTheme falls back per variable, not all-or-nothing', () => {
  // attached: happy-dom resolves custom properties off an element's style only while it
  // is in the document (a browser has no such restriction, and inherits them from ancestors)
  const el = document.createElement('div')
  document.body.appendChild(el)
  // nothing set anywhere: the library defaults
  expect(readLineTheme(el)).toEqual(LINE_THEME_DEFAULTS)
  // only ONE variable set, inline on the element (the only form happy-dom resolves)
  el.style.setProperty('--ne-line-selected', '#ff0000')
  const theme = readLineTheme(el)
  expect(theme.selected).toEqual([1, 0, 0, 1])
  expect(theme.base).toEqual(LINE_THEME_DEFAULTS.base) // untouched
  expect(theme.width).toBe(LINE_THEME_DEFAULTS.width)
  // a value that cannot be parsed falls back rather than throwing
  el.style.setProperty('--ne-line-color', 'hsl(1 2% 3%)')
  el.style.setProperty('--ne-line-width', 'wide')
  const t2 = readLineTheme(el)
  expect(t2.base).toEqual(LINE_THEME_DEFAULTS.base)
  expect(t2.width).toBe(LINE_THEME_DEFAULTS.width)
  el.remove()
})
