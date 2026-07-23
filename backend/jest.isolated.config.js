/**
 * Isolated Jest config for running a single test file without the global
 * `tests/setup.js` shim. The global setup requires `../src/index` which
 * transitively imports files with pre-existing typecheck errors; this
 * config keeps tests focused on the file under test.
 *
 * Usage:
 *   npx jest --config jest.isolated.config.js tests/middleware/idempotency.test.ts
 */

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: false,
      },
    ],
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
  forceExit: true,
  silent: false,
};
