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
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 43,
            functions: 48,
            lines: 43,
            statements: 44
        }
    },
    verbose: true,
    silent: false,
    testEnvironmentOptions: {
        url: 'http://localhost'
    },
    rootDir: '.',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    resolver: undefined,
    transformIgnorePatterns: [
        'node_modules/(?!(dayjs)/)'
    ]
}; 