/** Standalone config for moderation tests (JS only) */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/moderation.test.js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        declaration: false,
        strict: false,
      }
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transformIgnorePatterns: [],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
};