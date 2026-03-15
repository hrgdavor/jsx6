const { RuleTester } = require('eslint');
const rule = require('./signal-dependencies');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
});

ruleTester.run('signal-dependencies', rule, {
  valid: [
    // Simple case
    {
      code: '$S(() => $sig1() + $sig2(), $sig1, $sig2)',
    },
    // Filter case
    {
      code: '$F(v => v + 1, $sig1)',
    },
    // Multiple deps
    {
      code: '$F((v1, v2) => v1 + v2, $sig1, $sig2)',
    },
    // Local variable (not a signal usage) - though our logic is simple
    {
      code: '$S(() => { const x = 1; return x; })',
    },
    // Usage of signal in $F that is passed as argument
    {
      code: '$F($sigParam => $sigParam(), $sig1)',
    },
    // Signal bucket (full path)
    {
      code: '$S(() => $state.user.name(), $state.user.name)',
    },
    // Signal bucket (root path)
    {
      code: '$S(() => $state.user.name(), $state)',
    },
    // Simpler bucket (full path)
    {
      code: '$S(() => $user.name(), $user.name)',
    },
    // Simpler bucket (root path)
    {
      code: '$S(() => $user.name(), $user)',
    },
  ],
  invalid: [
    // Missing dependency
    {
      code: '$S(() => $sig1() + $sig2(), $sig1)',
      errors: [{ messageId: 'missingDependency', data: { name: '$sig2' } }],
    },
    // Missing signal bucket dependency
    {
      code: '$S(() => $state.user.name())',
      errors: [{ messageId: 'missingDependency', data: { name: '$state.user.name' } }],
    },
    // Missing simpler bucket dependency
    {
      code: '$S(() => $user.name())',
      errors: [{ messageId: 'missingDependency', data: { name: '$user.name' } }],
    },
    // Missing specific simpler bucket dependency (only root provided is OK, but missing both is not)
    {
      code: '$S(() => $user.name(), $sig1)',
      errors: [{ messageId: 'missingDependency', data: { name: '$user.name' } }],
    },
  ],
});

console.log('ESLint rule tests defined.');
