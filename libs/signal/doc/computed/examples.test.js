/**
 * Runs every example in `examples/`.
 *
 * The examples assert their own behaviour at module scope, so importing one is the test: a wrong
 * explanation in the docs — or a behaviour change in `src/` — fails here, in the package's own suite,
 * before any document can drift.
 */

import { expect, test } from 'bun:test'

const EXAMPLES = [
  'basic.js',
  'eager.js',
  'batching.js',
  'state.js',
  'dispose.js',
  'dependencies.js',
  'notification.js',
  'inspect.js',
]

for (const file of EXAMPLES) {
  test(`doc example: ${file}`, async () => {
    await import(`./examples/${file}`)
    expect(true).toBe(true)
  })
}

test('every example file is listed above', async () => {
  const { readdirSync } = await import('node:fs')
  const onDisk = readdirSync(import.meta.dir + '/examples')
    .filter(f => f.endsWith('.js'))
    .sort()
  expect(onDisk).toEqual([...EXAMPLES].sort())
})
