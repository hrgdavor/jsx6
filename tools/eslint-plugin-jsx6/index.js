const signalDependencies = require('./rules/signal-dependencies')

module.exports = {
  // `meta.name` is required by Oxlint to load a local JS plugin without an alias
  // (plan/eslint/README.md, item Y1). ESLint ignores plugin-level `meta`, so this is
  // harmless for the still-current linter.
  meta: { name: 'jsx6' },
  rules: {
    'signal-dependencies': signalDependencies,
  },
}
