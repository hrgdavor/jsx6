const signalDependencies = require('./rules/signal-dependencies');

module.exports = {
  rules: {
    'signal-dependencies': signalDependencies,
  },
};
