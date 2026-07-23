/**
 * Isolated Jest config for running individual test files without the
 * global `tests/setup.js` shim. The global setup requires the full
 * app entry which has unrelated TS errors; this config keeps tests
 * focused on the file under test.
 *
 * Usage:
 *   npx jest --config jest.isolated.config.js <path-to-test>
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
