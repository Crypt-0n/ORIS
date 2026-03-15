module.exports = {
    testEnvironment: 'node',
    setupFiles: ['./__tests__/setup.js'],
    setupFilesAfterEnv: ['./__tests__/setupAfterEnv.js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    transformIgnorePatterns: ['/node_modules/'],
    testTimeout: 10000,
};
