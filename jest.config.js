/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^next/server$': '<rootDir>/__mocks__/next-server.js',
    '^next/headers$': '<rootDir>/__mocks__/next-headers.js',
    '^next/cache$': '<rootDir>/__mocks__/noop.js',
    '^react$': '<rootDir>/__mocks__/react-shim.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        paths: { '@/*': ['./*'] },
        moduleResolution: 'node',
        types: ['jest', 'node'],
        esModuleInterop: true,
        jsx: 'react',
        skipLibCheck: true,
      },
    }],
  },
};
