/**
 * The debugging utilities: describing a signal, and intercepting the console so `console.log($sig)`
 * shows a value.
 */
import { expect, test } from 'bun:test'
import {
  $C,
  $State,
  describeSignal,
  hasConsoleInspection,
  installConsoleInspection,
  installConsoleInspection as install,
  isSignalish,
  signal,
  signalKind,
  signalLabel,
  signalName,
  staticSignal,
  uninstallConsoleInspection,
} from '../index.js'

/** A console stand-in that records what it was handed. */
const fakeConsole = () => {
  const calls = []
  const record =
    name =>
    (...args) => {
      calls.push([name, args])
      return args.length
    }
  return { calls, console: { log: record('log'), warn: record('warn'), error: record('error') } }
}

test('isSignalish recognises every signal shape and nothing else', () => {
  expect(isSignalish(signal(1))).toBe(true)
  expect(isSignalish($C(() => 1))).toBe(true)
  expect(isSignalish(staticSignal(1))).toBe(true)
  expect(isSignalish($State({ a: 1 }))).toBe(true)
  expect(isSignalish(() => 1)).toBe(false)
  expect(isSignalish(null)).toBe(false)
  expect(isSignalish(5)).toBe(false)
  expect(isSignalish({ get: () => 1 })).toBe(false)
})

test('signalKind, signalName and signalLabel describe a signal', () => {
  const $count = signal(1, 'count')
  expect(signalKind($count)).toBe('signal')
  expect(signalName($count)).toBe('count')
  expect(signalLabel($count)).toBe('signal count = 1')

  const $double = $C(() => $count() * 2)
  expect(signalKind($double)).toBe('computed')
  expect(signalLabel($double)).toBe('computed = 2')

  const $state = $State({ n: 1 })
  expect(signalKind($state)).toBe('$State')
  expect(signalLabel($state)).toContain('{"n":1}')
  // Reading the label must not add fields to the state (the proxy trap would create child signals).
  expect($state()).toEqual({ n: 1 })
  expect(signalName($count)).toBe('count')
})

test('describeSignal returns a plain object whose value is readable', () => {
  const $count = signal(1, 'count')
  const described = describeSignal($count)
  expect(described.signal).toBe('count')
  expect(described.kind).toBe('signal')
  expect(described.value).toBe(1)
  expect(described.raw).toBe($count)
  expect(described.read()).toBe(1)

  $count(7)
  expect(described.value).toBe(1) // a snapshot from when it was described
  expect(described.read()).toBe(7) // …while read() is current
  expect(Object.keys(described)).toEqual(['signal', 'kind', 'value', 'read', 'raw'])
})

test('describeSignal names an anonymous signal and never throws', () => {
  expect(describeSignal(signal(1)).signal).toBe('signal') // '$signal' is the closure name, not a label
  const { $C: $c } = { $C }
  const broken = $c(() => {
    throw new Error('boom')
  })
  expect(describeSignal(broken).value).toBe('⚠ boom')
  expect(signalLabel(broken)).toBe('computed = ⚠ boom')
})

test('installConsoleInspection replaces signal arguments with a description', () => {
  const { calls, console: fake } = fakeConsole()
  const uninstall = installConsoleInspection({ console: fake })
  try {
    const $count = signal(1, 'count')
    fake.log('count is', $count, 42, 'plain')
    const [, args] = calls[0]
    expect(args[0]).toBe('count is')
    expect(args[1].value).toBe(1)
    expect(args[1].signal).toBe('count')
    expect(args[2]).toBe(42) // untouched
    expect(args[3]).toBe('plain')
    expect(hasConsoleInspection(fake)).toBe(true)

    $count(5)
    fake.warn($count)
    expect(calls[1][0]).toBe('warn')
    expect(calls[1][1][0].value).toBe(5) // described at log time, so current

    // asString mode prints the one-liner instead
    uninstall()
    installConsoleInspection({ console: fake, asString: true })
    fake.error('now', $count)
    expect(calls[2][1][1]).toBe('signal count = 5')
  } finally {
    uninstallConsoleInspection(fake)
  }
  expect(hasConsoleInspection(fake)).toBe(false)
})

test('installConsoleInspection is idempotent, restores originals, and calls through', () => {
  const { calls, console: fake } = fakeConsole()
  const originalLog = fake.log
  const uninstall = install({ console: fake })
  const wrapped = fake.log

  expect(wrapped).not.toBe(originalLog)
  expect(wrapped.original).toBe(originalLog)
  expect(wrapped.__jsx6ConsoleInspection).toBe(true)

  // Installing again must not stack a second wrapper.
  install({ console: fake })
  expect(fake.log).toBe(wrapped)

  uninstall()
  expect(fake.log).toBe(originalLog)
  install({ console: fake })
  uninstallConsoleInspection(fake)
  expect(fake.log).toBe(originalLog)

  fake.log('still works')
  expect(calls.at(-1)).toEqual(['log', ['still works']])
})

test('the wrapper does not touch required behaviour when nothing is a signal', () => {
  const { calls, console: fake } = fakeConsole()
  const uninstall = installConsoleInspection({ console: fake })
  try {
    const error = new Error('as an argument')
    fake.log('a', 1, { b: 2 }, [3], error, null, undefined)
    const [, args] = calls[0]
    expect(args).toEqual(['a', 1, { b: 2 }, [3], error, null, undefined])
  } finally {
    uninstall()
  }
})

test('showCallSite appends the caller location', () => {
  const { calls, console: fake } = fakeConsole()
  const uninstall = installConsoleInspection({ console: fake, showCallSite: true })
  try {
    fake.log(signal(1))
    const [, args] = calls[0]
    expect(args.length).toBe(2)
    expect(String(args[1])).toMatch(/^\(logged from .+:\d+:\d+\)$/)
    expect(String(args[1])).toContain('debug.test.js')
  } finally {
    uninstall()
  }
})

test('installConsoleInspection tolerates a console without the methods', () => {
  const uninstall = installConsoleInspection({ console: { log: undefined } })
  expect(typeof uninstall).toBe('function')
  uninstall()
  expect(installConsoleInspection({ console: undefined })).toBeInstanceOf(Function)
})
