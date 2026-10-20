const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: [
    '**/tests/routes/comprehensiveRoutes.test.ts',
    '**/tests/routes/featureFlags.test.ts',
  ],
  collectCoverageFrom: [
    'src/routes/verify.ts',
    'src/routes/disputes.ts',
    'src/routes/metrics.ts',
    'src/routes/forum.ts',
    'src/routes/notifications.ts',
    'src/routes/progress.ts',
    'src/routes/classroom.ts',
    'src/routes/bookmarks.js',
    'src/routes/localization.ts',
    'src/routes/vrf.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
