/** @type {import('jest').Config} */
module.exports = {
  preset:       'ts-jest',
  testEnvironment: 'node',
  roots:        ['<rootDir>/src'],
  testMatch:    ['**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
};
