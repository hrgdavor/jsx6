import { afterEach, expect, test } from 'bun:test'

import { urlBool, urlGet, urlInit, urlInitBool, urlSet, urlStr, refreshUrl, setUrl } from './index.js'

/**
 * `location` does not exist in this runner, which is exactly the situation the module used to
 * crash on at import time. Install a writable stand-in so the lazy path can be exercised.
 */
const setLocation = href => {
  Object.defineProperty(globalThis, 'location', {
    value: { toString: () => href },
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  setLocation('https://example.com/app')
})

// The module must be importable outside a browser: the parsed URL is created lazily.
test('the module imports without touching location', () => {
  expect(typeof urlStr).toBe('function')
})

test('urlBool', () => {
  expect(urlBool('')).toBe(true)
  expect(urlBool('1')).toBe(true)
  expect(urlBool('true')).toBe(true)
  expect(urlBool('0')).toBe(false)
  expect(urlBool('false')).toBe(false)
  expect(urlBool(null)).toBe(false)
})

test('query params round-trip through an explicitly provided url', () => {
  setUrl('https://example.com/app?keep=1')
  expect(urlGet('keep')).toBe('1')

  urlSet('added', 'yes')
  expect(urlGet('added')).toBe('yes')
  expect(urlStr()).toContain('added=yes')

  urlSet('added', null)
  expect(urlGet('added')).toBe(null)
})

// The old implementation parsed the location once at import and never looked again, so a
// client-side navigation left it permanently stale.
test('refreshUrl re-reads the location after client-side navigation', () => {
  setLocation('https://example.com/app?page=1')
  refreshUrl()
  expect(urlGet('page')).toBe('1')

  setLocation('https://example.com/app?page=2')
  refreshUrl()
  expect(urlGet('page')).toBe('2')
  expect(urlStr()).toContain('page=2')
})

test('urlInit sets a default only when missing', () => {
  setUrl('https://example.com/app')
  expect(urlInit('a', 'def')).toBe('def')
  expect(urlInit('a', 'other')).toBe('def')
  expect(urlGet('a')).toBe('def')
  expect(urlInitBool('flag', 'true')).toBe(true)
})