const jsx6 = require('./tools/eslint-plugin-jsx6');

/** Globals provided by `bun test` (auto-imported, so test files never import them). */
const testGlobals = {
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
};

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    // Some first-party .js files contain JSX (e.g. libs/jsx6/src/HiddenInput.js),
    // so JSX must be enabled for plain .js as well as .jsx.
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['jsx6'],
  rules: {
    'jsx6/signal-dependencies': 'warn',
    // Callback parameters such as `(value, index, self)` are part of documented APIs and are
    // frequently unused; only genuinely unused *variables* are reported.
    'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // The test suite relies on globals injected by `bun test`, and test scaffolding often keeps
      // deliberately unused imports/variables for readability.
      files: ['**/*.test.js', '**/test/**/*.js'],
      globals: testGlobals,
      rules: {
        'no-unused-vars': 'off',
      },
    },
    {
      // Repo tooling runs on Bun and shells out to npm.
      files: ['scripts/**/*.js', 'tools/**/*.js'],
      globals: { Bun: 'readonly' },
    },
    {
      // Documentation samples are illustrative snippets, not lintable source.
      files: ['**/samples/**/*.js', '**/samples/**/*.jsx'],
      rules: { 'no-unused-vars': 'off' },
    },
  ],
  // Kept in sync with .eslintignore; both exist so editors and the CLI agree.
  ignorePatterns: [
    'node_modules/',
    '.history/',
    '.tmp/',
    'coverage/',
    'dist/',
    'esm/',
    'cjs/',
    'build/',
    'build_dev/',
    'docs/',
    '**/*.min.js',
  ],
};