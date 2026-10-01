/**
 * Process-wide monotonic change sequence for connector geometry.
 *
 * Every geometric change of a `ConnectLine` stamps the line with the next id from
 * this sequence (`nextChangeId()`), and every cached derivation of that shape — the
 * SVG `d` text, the sampled polyline, its bounding box, a spatial-index leaf —
 * records the id it was built at. "Is this cache stale?" is then a comparison
 * against `line.changeId`, LOCAL to the line: it does not depend on what else in the
 * editor moved, and moving one connector cannot invalidate another's cache.
 *
 * `changeSeq()` returns the current value, which answers the coarser question "has
 * ANY connector changed since I last looked?". That is the one thing a global
 * counter is actually good for — skipping work without walking the lines (the
 * canvas layer uses it to know whether its built edge list is still current). It is
 * deliberately NOT the validity test for per-line caches: using it there would
 * invalidate every line's geometry whenever a single line moved, which is the
 * O(lines) work per drag the caches exist to avoid.
 *
 * The sequence is never reset, so ids are unique across editors and across the whole
 * session — handy in a dirty-set or a debug log, and free (an integer counter).
 */

/** @type {number} */
let seq = 0

/**
 * The next change id. Called once per geometric change of a connector.
 *
 * @returns {number}
 */
export const nextChangeId = () => ++seq

/**
 * The current value of the sequence: compare it with a remembered one to ask "has
 * any connector changed since?".
 *
 * @returns {number}
 */
export const changeSeq = () => seq
