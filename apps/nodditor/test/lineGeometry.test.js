/**
 * The connector's geometry model: numeric edge as the source of truth, the derived
 * SVG text, the sampled polyline, and the process-wide change sequence.
 *
 * These are pure functions — no DOM — and they are also the parity gate against
 * `@jsx6/line-render`, which has its own copies of the same math (`connectorEdge`,
 * `edgeToPath`, `sampleEdgePoints`) because nodditor must keep working when that
 * package is not installed. Two implementations of one formula drift; this file is
 * what makes the drift a test failure instead of a visual bug.
 */
import { expect, test } from 'bun:test'

import { changeSeq, nextChangeId } from '../src/changeSeq.js'
import {
  connectorEdge,
  edgeToSvg,
  makeLineConnector,
  pointsBounds,
  sampleEdgePoints,
} from '../src/makeLineConnector.js'
import {
  connectorEdge as lrConnectorEdge,
  edgeToPath,
  makeConnector,
  polylineBounds as lrPolylineBounds,
  sampleEdgePoints as lrSampleEdgePoints,
} from '@jsx6/line-render'

const CASES = [
  [[0, 0], [100, 50], 40],
  [[10, 10], [10, 10], 60], // zero length
  [[0, 0], [3, 4], 1], // strength below half the distance
  [[-5, 2], [7, -9], 999], // strength clamped
  [[351.95, 148.96], [239.95, 498.96], 60],
]

test('the numeric connector agrees with the legacy string form and with line-render', () => {
  for (const [p1, p2, strength] of CASES) {
    const edge = connectorEdge(strength, p1, p2)
    const svg = edgeToSvg(edge)
    // the old signature is still the same string (it is public API)
    expect(svg).toBe(makeLineConnector(strength, p1, null, null, 'R', p2, null, null, 'L'))
    // ... and so is line-render's string and numeric form
    expect(svg).toBe(makeConnector(p1, p2, strength))
    expect(edge).toEqual(lrConnectorEdge(p1, p2, strength))
    expect(svg).toBe(edgeToPath(lrConnectorEdge(p1, p2, strength)))
  }
})

test('the sampled polyline and its bounds match line-render', () => {
  for (const [p1, p2, strength] of CASES) {
    const edge = connectorEdge(strength, p1, p2)
    for (const segments of [4, 24]) {
      const mine = sampleEdgePoints(edge, segments)
      const theirs = lrSampleEdgePoints(edge, segments)
      expect(Array.from(mine)).toEqual(Array.from(theirs))
      expect(pointsBounds(mine)).toEqual(lrPolylineBounds(theirs))
    }
  }
})

test('the change sequence hands out unique, increasing, process-wide ids', () => {
  const a = nextChangeId()
  const b = nextChangeId()
  expect(b).toBe(a + 1)
  expect(changeSeq()).toBe(b)
  // the sequence is global: a third caller gets the very next id
  expect(changeSeq() + 1).toBe(nextChangeId())
})
