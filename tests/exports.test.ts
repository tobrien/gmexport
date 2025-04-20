import { jest } from '@jest/globals';

// Mock the storage module
const mockCreate = jest.fn();
jest.unstable_mockModule('../src/util/storage.js', () => ({
    __esModule: true,
    create: mockCreate
}));

// Import modules asynchronously using dynamic imports to support ESM
let Storage: any;
let ConfigError: any;
let createConfig: any;
let setDefaultsForMissing: any;
let overrideWithParamValues: any;
let checkForConflicts: any;
let validateRequiredFields: any;

// Import constants using static imports which work fine
import { DEFAULT_CREDENTIALS_FILE, DEFAULT_DESTINATION_DIR, DEFAULT_FILENAME_OPTIONS, DEFAULT_OUTPUT_STRUCTURE, DEFAULT_SCOPES, DEFAULT_TOKEN_FILE } from '../src/constants.js';
import { Config } from '../src/export.d.js';
import { getLogger } from '../src/logging.js';
import { FilenameOption, OutputStructure } from '@tobrien/cabazooka';
// Mock general utility
jest.mock('../src/util/general.js', () => ({
    deepMerge: jest.fn((target: any, source: any) => ({ ...target, ...source }))
}));

// Load all dynamic imports before tests
beforeAll(async () => {
    Storage = await import('../src/util/storage.js');

    const exportModule = await import('../src/export.js');
    ConfigError = exportModule.ConfigError;
    createConfig = exportModule.createConfig;
    setDefaultsForMissing = exportModule.setDefaultsForMissing;
    overrideWithParamValues = exportModule.overrideWithParamValues;
    checkForConflicts = exportModule.checkForConflicts;
    validateRequiredFields = exportModule.validateRequiredFields;
});

describe('export', () => {

    // Setup mock storage
    const mockStorage = {
        readFile: jest.fn(),
        isDirectoryWritable: jest.fn(),
        isFileReadable: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockCreate.mockReturnValue(mockStorage);

        // Default mock implementations
        mockStorage.isDirectoryWritable.mockReturnValue(Promise.resolve(true));
        mockStorage.isFileReadable.mockReturnValue(Promise.resolve(true));
    });

    describe('ConfigError', () => {
        it('should create error with correct name and message', () => {
            const error = new ConfigError('Test error message');
            expect(error.name).toBe('Export.ConfigError');
            expect(error.message).toBe('Test error message');
        });
    });

    describe('setDefaultsForMissing', () => {
        it('should set all defaults for empty config', async () => {
            const config: Partial<Config> = {};
            await setDefaultsForMissing(config);

            expect(config.outputDirectory).toBe(DEFAULT_DESTINATION_DIR);
            expect(config.outputStructure).toBe(DEFAULT_OUTPUT_STRUCTURE);
            expect(config.filenameOptions).toEqual(DEFAULT_FILENAME_OPTIONS);
            expect(config.credentialsFile).toBe(DEFAULT_CREDENTIALS_FILE);
            expect(config.tokenFile).toBe(DEFAULT_TOKEN_FILE);
            expect(config.apiScopes).toEqual(DEFAULT_SCOPES);
        });

        it('should not override existing values', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/custom/dir',
                apiScopes: ['custom-scope']
            };
            await setDefaultsForMissing(config);

            expect(config.outputDirectory).toBe('/custom/dir');
            expect(config.apiScopes).toEqual(['custom-scope']);
            expect(config.outputStructure).toBe(DEFAULT_OUTPUT_STRUCTURE);
        });
    });

    describe('overrideWithParamValues', () => {
        it('should override config with param values', async () => {
            const config: Partial<Config> = {
                outputDirectory: DEFAULT_DESTINATION_DIR,
                outputStructure: DEFAULT_OUTPUT_STRUCTURE
            };

            const params = {
                outputDirectory: '/param/dir',
                filenameOptions: ['time'] as FilenameOption[]
            };

            await overrideWithParamValues(params, config);

            expect(config.outputDirectory).toBe('/param/dir');
            expect(config.filenameOptions).toEqual(['time']);
            expect(config.outputStructure).toBe(DEFAULT_OUTPUT_STRUCTURE);
        });

        it('should ignore undefined param values', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/config/dir',
                outputStructure: 'year' as OutputStructure
            };

            const params = {
                outputDirectory: undefined,
                filenameOptions: undefined
            };

            await overrideWithParamValues(params, config);

            expect(config.outputDirectory).toBe('/config/dir');
            expect(config.outputStructure).toBe('year');
        });
    });

    describe('checkForConflicts', () => {
        it('should not throw for non-conflicting values', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/config/dir'
            };

            const params = {
                apiScopes: ['scope1']
            };

            await expect(checkForConflicts(params, config)).resolves.toBe(config);
        });

        it('should throw ConfigError for conflicting values', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/config/dir'
            };

            const params = {
                outputDirectory: '/param/dir'
            };

            await expect(checkForConflicts(params, config)).rejects.toThrow(ConfigError);
            await expect(checkForConflicts(params, config)).rejects.toThrow(/Conflicting output directory settings/);
        });
    });

    describe('validateRequiredFields', () => {
        it('should validate a complete config', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/valid/dir',
                outputStructure: 'year' as OutputStructure,
                filenameOptions: ['date'] as FilenameOption[],
                credentialsFile: '/valid/creds.json',
                tokenFile: '/valid/token.json',
                apiScopes: ['scope1']
            };

            mockStorage.isDirectoryWritable.mockImplementation(async () => {
                const logger = getLogger();
                return Promise.resolve(true);
            });
            mockStorage.isFileReadable.mockImplementation(async () => {
                const logger = getLogger();
                return Promise.resolve(true);
            });

            await expect(validateRequiredFields(config)).resolves.toEqual(config);
        });

        it('should throw for missing required fields', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/valid/dir',
                // Missing other required fields
            };

            await expect(validateRequiredFields(config)).rejects.toThrow(ConfigError);
            await expect(validateRequiredFields(config)).rejects.toThrow(/Missing required fields/);
        });

        it('should throw when directory is not writable', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/invalid/dir',
                outputStructure: 'year' as OutputStructure,
                filenameOptions: ['date'] as FilenameOption[],
                credentialsFile: '/valid/creds.json',
                tokenFile: '/valid/token.json',
                apiScopes: ['scope1']
            };

            mockStorage.isDirectoryWritable.mockReturnValue(Promise.resolve(false));
            mockStorage.isFileReadable.mockReturnValue(Promise.resolve(true));

            await expect(validateRequiredFields(config)).rejects.toThrow(ConfigError);
            await expect(validateRequiredFields(config)).rejects.toThrow(/Directory is not writeable/);
        });

        it('should throw when credentials file is not readable', async () => {
            const config: Partial<Config> = {
                outputDirectory: '/valid/dir',
                outputStructure: 'year' as OutputStructure,
                filenameOptions: ['date'] as FilenameOption[],
                credentialsFile: '/invalid/creds.json',
                tokenFile: '/valid/token.json',
                apiScopes: ['scope1']
            };

            mockStorage.isDirectoryWritable.mockReturnValue(Promise.resolve(true));
            mockStorage.isFileReadable.mockReturnValue(Promise.resolve(false));

            await expect(validateRequiredFields(config)).rejects.toThrow(ConfigError);
            await expect(validateRequiredFields(config)).rejects.toThrow(/File is not readable/);
        });
    });

    describe('createConfig', () => {
        it('should create config from params without config file', async () => {
            const params = {
                outputDirectory: '/param/dir',
                filenameOptions: ['time'] as FilenameOption[]
            };

            const expectedConfig: Config = {
                outputDirectory: '/param/dir',
                outputStructure: DEFAULT_OUTPUT_STRUCTURE,
                filenameOptions: ['time'],
                credentialsFile: DEFAULT_CREDENTIALS_FILE,
                tokenFile: DEFAULT_TOKEN_FILE,
                apiScopes: DEFAULT_SCOPES,
                filters: {
                    exclude: {},
                    include: {}
                }
            };

            mockStorage.isDirectoryWritable.mockReturnValue(Promise.resolve(true));
            mockStorage.isFileReadable.mockReturnValue(Promise.resolve(true));

            const result = await createConfig(params);
            expect(result).toEqual(expectedConfig);
        });

        it('should load and merge config file when provided', async () => {
            const configFileContent = `
outputDirectory: /config/dir
outputStructure: month
filters:
  include:
    from:
      - test@example.com
`;

            const params = {
                configFile: '/path/to/config.yaml',
                filenameOptions: ['time'] as FilenameOption[]
            };

            mockStorage.readFile.mockReturnValue(Promise.resolve(configFileContent));
            mockStorage.isDirectoryWritable.mockReturnValue(Promise.resolve(true));
            mockStorage.isFileReadable.mockReturnValue(Promise.resolve(true));

            const result = await createConfig(params);

            expect(mockStorage.readFile).toHaveBeenCalledWith('/path/to/config.yaml', expect.any(String));
            expect(result.outputDirectory).toBe('/config/dir');
            expect(result.outputStructure).toBe('month');
            expect(result.filenameOptions).toEqual(['time']);
            expect(result.filters?.include?.from).toEqual(['test@example.com']);
        });

        it('should throw when there are conflicting settings', async () => {
            const configFileContent = `
outputDirectory: /config/dir
`;

            const params = {
                configFile: '/path/to/config.yaml',
                outputDirectory: '/param/dir'
            };

            mockStorage.readFile.mockReturnValue(Promise.resolve(configFileContent));

            await expect(createConfig(params)).rejects.toThrow(ConfigError);
            await expect(createConfig(params)).rejects.toThrow(/Conflicting output directory settings/);
        });

        it('should throw when validation fails', async () => {
            const params = {
                outputDirectory: '/param/dir',
                // Missing other required fields
            };

            mockStorage.isDirectoryWritable.mockReturnValue(Promise.resolve(false));

            await expect(createConfig(params)).rejects.toThrow(ConfigError);
        });
    });
});
