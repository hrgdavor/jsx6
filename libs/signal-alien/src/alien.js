/**
 * The one place that knows where the alien-signals dependency comes from.
 *
 * Everything else in this package imports `./alien.js`, so swapping the source of the dependency (a
 * different build, a pinned fork, an instrumented wrapper) is a one-line change here.
 */

export * from 'alien-signals'
