module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transform: {
    '^.+\\.[tj]sx?$': ['@swc/jest', {
      jsc: {
        target: 'es2020',
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
      module: { type: 'commonjs' },
    }],
  },
  coverageDirectory: './coverage',
};
