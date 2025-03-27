/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleDirectories: ['node_modules', 'src'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            useESM: true,
        }],
    },
    roots: ['<rootDir>/src/', '<rootDir>/tests/'],
    modulePaths: ['<rootDir>/src/'],
    maxWorkers: 1,
    workerIdleMemoryLimit: '512MB',
    testTimeout: 30000,
    setupFiles: ['<rootDir>/tests/setup.ts']
}; 