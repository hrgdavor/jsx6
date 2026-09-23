import js from '@eslint/js'
import pluginJsx6 from './tools/eslint-plugin-jsx6/index.js'
import globals from 'globals'

/**
 * ESLint flat config (ESLint 9) — replaces the legacy `.eslintrc.cjs` + `.eslintignore` pair
 * (`plan/rush/README.md`, item R5).
 *
 * Notes for future readers:
 *   - JSX is enabled for plain `.js` as well as `.jsx`: some first-party files (for example
 *     `libs/jsx6/src/HiddenInput.js`) contain JSX without a `.jsx` extension. This is why the
 *     config is syntax-only, with no type-aware linting.
 *   - Ignores are inlined here rather than in a separate file; ESLint 9 removed `.eslintignore`
 *     support. `scripts/verify.js` only lints `libs`, `tools` and `scripts`, so these patterns exist
 *     for `bun run lint` / editor use, which lint the whole tree.
 *   - Globals come from the `globals` package, which is what the old `env: { browser, node }` block
 *     meant before flat config removed `env`.
 */
export default [
  {
    name: 'jsx6/ignores',
    // Patterns must match nested paths (`**/dist/**`), not bare directory names: unlike the old
    // `.eslintignore`, a flat-config global ignore of `dist` only matches `<root>/dist`, so the
    // generated `dist/`, `esm/`, `cjs/` and `build/` inside every package would be linted.
    ignores: [
      '**/node_modules/**',
      '**/.history/**',
      '**/.tmp/**',
      '**/coverage/**',
      '**/dist/**',
      '**/esm/**',
      '**/cjs/**',
      '**/build/**',
      '**/build_dev/**',
      '**/docs/**',
      '**/*.min.js',
      '**/public/vendor/**',
    ],
  },
  {
    name: 'jsx6/language',
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: { jsx6: pluginJsx6 },
    rules: {
      ...js.configs.recommended.rules,
      'jsx6/signal-dependencies': 'warn',
      // Callback parameters such as `(value, index, self)` are part of documented APIs and are
      // frequently unused; only genuinely unused *variables* are reported.
      'no-unused-vars': [
        'error',
        // `caughtErrors: 'none'` preserves the pre-ESLint-9 behaviour: flat config defaults to
        // reporting unused catch parameters, which the legacy config never did.
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // CommonJS config/tooling files (this worked via `env.node` + `sourceType` inference before).
    name: 'jsx6/cjs',
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    // The test suite relies on globals injected by `bun test`, and test scaffolding often keeps
    // deliberately unused imports/variables for readability.
    name: 'jsx6/tests',
    files: ['**/*.test.js', '**/*.test.jsx', '**/test/**/*.js'],
    languageOptions: {
      globals: {
        test: 'readonly',
        it: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        mock: 'readonly',
        spyOn: 'readonly',
      },
    },
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // Repo tooling runs on Bun.
    name: 'jsx6/tooling',
    files: ['scripts/**/*.js', 'tools/**/*.js'],
    languageOptions: { globals: { Bun: 'readonly' } },
  },
  {
    // Documentation samples are illustrative snippets, not lintable source.
    name: 'jsx6/samples',
    files: ['**/samples/**/*.js', '**/samples/**/*.jsx'],
    rules: { 'no-unused-vars': 'off' },
  },
]
