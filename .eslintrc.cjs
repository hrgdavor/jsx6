const jsx6 = require('./tools/eslint-plugin-jsx6');

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
  },
  plugins: ['jsx6'],
  rules: {
    'jsx6/signal-dependencies': 'warn',
  },
};
