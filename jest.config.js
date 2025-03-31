/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleDirectories: ['node_modules', 'src'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.json'
            }
        ]
    },
    roots: ['<rootDir>/src/', '<rootDir>/tests/'],
    modulePaths: ['<rootDir>/src/'],
    maxWorkers: '50%',
    workerIdleMemoryLimit: '512MB',
    testTimeout: 30000,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            statements: 76,
            branches: 71,
            functions: 88,
            lines: 76,
        }
    },
    verbose: true,
    silent: false,
    testEnvironmentOptions: {
        url: 'http://localhost'
    },
    rootDir: '.',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transformIgnorePatterns: [
        'node_modules/(?!(dayjs)/)'
    ]
}; 