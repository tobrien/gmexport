import { jest } from '@jest/globals';
import { Command } from 'commander';
import { ALLOWED_SCOPES, DEFAULT_TIMEZONE } from '../src/constants.js';

// Define proper typed mock functions
const mockExists = jest.fn<(path: string) => Promise<boolean>>();
const mockIsFileReadable = jest.fn<(path: string) => Promise<boolean>>();
const mockIsDirectoryWritable = jest.fn<(path: string) => Promise<boolean>>();
const mockCreateDirectory = jest.fn<(path: string) => Promise<void>>();

// Setup storage mock with proper types
const mockStorageUtility = {
    exists: mockExists,
    isFileReadable: mockIsFileReadable,
    isDirectoryWritable: mockIsDirectoryWritable,
    createDirectory: mockCreateDirectory,
    isDirectory: jest.fn(),
    isFile: jest.fn(),
    isReadable: jest.fn(),
    isWritable: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
};

// Mock the storage module
const mockCreate = jest.fn().mockReturnValue(mockStorageUtility);
jest.unstable_mockModule('../src/util/storage.js', () => ({
    __esModule: true,
    create: mockCreate
}));

// Import modules asynchronously using dynamic imports to support ESM
let mockRun: any;
let mockExport: any;
let ArgumentError: any;
let configure: any;
let generateConfig: any;
let validateApiScopes: any;
let validateFilenameOptions: any;
let validateOutputStructure: any;
let validateTimezone: any;
let validateCredentialsFile: any;
let validateTokenFile: any;
let validateConfig: any;
let validateOutputDirectory: any;
let Storage: any;

// Mock dependencies
jest.mock('../src/run.js', () => ({
    __esModule: true,
    createConfig: jest.fn(() => ({ verbose: false, dryRun: false }))
}));

jest.mock('../src/export.js', () => ({
    __esModule: true,
    createConfig: jest.fn(async () => ({ outputDirectory: '/tmp', credentialsFile: './credentials.json' }))
}));

// Load all dynamic imports before tests
beforeAll(async () => {
    Storage = await import('../src/util/storage.js');
    mockRun = await import('../src/run.js');
    mockExport = await import('../src/export.js');

    const argumentsModule = await import('../src/arguments.js');
    ArgumentError = argumentsModule.ArgumentError;
    configure = argumentsModule.configure;
    generateConfig = argumentsModule.generateConfig;
    validateApiScopes = argumentsModule.validateApiScopes;
    validateFilenameOptions = argumentsModule.validateFilenameOptions;
    validateOutputStructure = argumentsModule.validateOutputStructure;
    validateTimezone = argumentsModule.validateTimezone;
    validateCredentialsFile = argumentsModule.validateCredentialsFile;
    validateTokenFile = argumentsModule.validateTokenFile;
    validateConfig = argumentsModule.validateConfig;
    validateOutputDirectory = argumentsModule.validateOutputDirectory;
});

describe('arguments', () => {
    let program: Command;

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        mockExists.mockResolvedValue(true);
        mockIsFileReadable.mockResolvedValue(true);
        mockIsDirectoryWritable.mockResolvedValue(true);
        mockCreateDirectory.mockResolvedValue(undefined);

        program = new Command();
        configure(program);
    });

    describe('configure', () => {
        it('should configure program with all options', () => {
            const options = program.opts();
            expect(program.name()).toBe('gmexport');
            expect(program.description()).toBeDefined();
            expect(program.summary).toBeDefined();
        });
    });

    describe('validateApiScopes', () => {
        it('should not throw for valid scopes', () => {
            expect(() => validateApiScopes(ALLOWED_SCOPES)).not.toThrow();
        });

        it('should throw for invalid scopes', () => {
            expect(() => validateApiScopes(['invalid-scope'])).toThrow(ArgumentError);
        });

        it('should throw for empty scopes array', () => {
            expect(() => validateApiScopes([])).toThrow(ArgumentError);
        });
    });

    describe('validateTimezone', () => {
        it('should return timezone if valid', () => {
            expect(validateTimezone(DEFAULT_TIMEZONE)).toBe(DEFAULT_TIMEZONE);
        });

        it('should throw for invalid timezone', () => {
            expect(() => validateTimezone('invalid-timezone')).toThrow(ArgumentError);
        });
    });

    describe('validateOutputStructure', () => {
        it('should not throw for valid structure', () => {
            expect(() => validateOutputStructure('year')).not.toThrow();
            expect(() => validateOutputStructure('month')).not.toThrow();
            expect(() => validateOutputStructure('day')).not.toThrow();
        });

        it('should throw for invalid structure', () => {
            expect(() => validateOutputStructure('invalid')).toThrow(ArgumentError);
        });
    });

    describe('validateFilenameOptions', () => {
        it('should not throw for valid options', () => {
            expect(() => validateFilenameOptions(['date', 'subject'], 'year')).not.toThrow();
        });

        it('should throw for invalid options', () => {
            expect(() => validateFilenameOptions(['invalid'], 'year')).toThrow(ArgumentError);
        });

        it('should throw when using date with day structure', () => {
            expect(() => validateFilenameOptions(['date'], 'day')).toThrow(ArgumentError);
        });

        it('should throw for comma-separated options', () => {
            expect(() => validateFilenameOptions(['date,time'], 'year')).toThrow(ArgumentError);
        });

        it('should throw for quoted string options', () => {
            expect(() => validateFilenameOptions(['date time'], 'year')).toThrow(ArgumentError);
        });
    });

    describe('validateCredentialsFile', () => {
        it('should not throw when credentials file exists and is readable', async () => {
            mockExists.mockResolvedValue(true);
            mockIsFileReadable.mockResolvedValue(true);

            await expect(validateCredentialsFile('/path/to/credentials.json')).resolves.not.toThrow();
            expect(mockExists).toHaveBeenCalledWith('/path/to/credentials.json');
            expect(mockIsFileReadable).toHaveBeenCalledWith('/path/to/credentials.json');
        });

        it('should not throw when credentials file is undefined', async () => {
            await expect(validateCredentialsFile(undefined)).resolves.not.toThrow();
            expect(mockExists).not.toHaveBeenCalled();
            expect(mockIsFileReadable).not.toHaveBeenCalled();
        });

        it('should throw when credentials file does not exist', async () => {
            mockExists.mockResolvedValue(false);

            await expect(validateCredentialsFile('/path/to/credentials.json')).rejects.toThrow(ArgumentError);
            expect(mockExists).toHaveBeenCalledWith('/path/to/credentials.json');
            expect(mockIsFileReadable).not.toHaveBeenCalled();
        });

        it('should throw when credentials file is not readable', async () => {
            mockExists.mockResolvedValue(true);
            mockIsFileReadable.mockResolvedValue(false);

            await expect(validateCredentialsFile('/path/to/credentials.json')).rejects.toThrow(ArgumentError);
            expect(mockExists).toHaveBeenCalledWith('/path/to/credentials.json');
            expect(mockIsFileReadable).toHaveBeenCalledWith('/path/to/credentials.json');
        });
    });

    describe('validateTokenFile', () => {
        it('should not throw when token file exists and is readable', async () => {
            mockExists.mockResolvedValue(true);
            mockIsFileReadable.mockResolvedValue(true);

            await expect(validateTokenFile('/path/to/token.json')).resolves.not.toThrow();
            expect(mockExists).toHaveBeenCalledWith('/path/to/token.json');
            expect(mockIsFileReadable).toHaveBeenCalledWith('/path/to/token.json');
        });

        it('should not throw when token file is undefined', async () => {
            await expect(validateTokenFile(undefined)).resolves.not.toThrow();
            expect(mockExists).not.toHaveBeenCalled();
            expect(mockIsFileReadable).not.toHaveBeenCalled();
        });

        it('should throw when token file does not exist', async () => {
            mockExists.mockResolvedValue(false);

            await expect(validateTokenFile('/path/to/token.json')).rejects.toThrow(ArgumentError);
            expect(mockExists).toHaveBeenCalledWith('/path/to/token.json');
            expect(mockIsFileReadable).not.toHaveBeenCalled();
        });

        it('should throw when token file is not readable', async () => {
            mockExists.mockResolvedValue(true);
            mockIsFileReadable.mockResolvedValue(false);

            await expect(validateTokenFile('/path/to/token.json')).rejects.toThrow(ArgumentError);
            expect(mockExists).toHaveBeenCalledWith('/path/to/token.json');
            expect(mockIsFileReadable).toHaveBeenCalledWith('/path/to/token.json');
        });
    });

    describe('validateConfig', () => {
        it('should not throw when config file exists and is readable', async () => {
            mockExists.mockResolvedValue(true);
            mockIsFileReadable.mockResolvedValue(true);

            await expect(validateConfig('/path/to/config.json')).resolves.not.toThrow();
            expect(mockExists).toHaveBeenCalledWith('/path/to/config.json');
            expect(mockIsFileReadable).toHaveBeenCalledWith('/path/to/config.json');
        });

        it('should not throw when config file is undefined', async () => {
            await expect(validateConfig(undefined)).resolves.not.toThrow();
            expect(mockExists).not.toHaveBeenCalled();
            expect(mockIsFileReadable).not.toHaveBeenCalled();
        });

        it('should throw when config file does not exist', async () => {
            mockExists.mockResolvedValue(false);

            await expect(validateConfig('/path/to/config.json')).rejects.toThrow(ArgumentError);
            expect(mockExists).toHaveBeenCalledWith('/path/to/config.json');
            expect(mockIsFileReadable).not.toHaveBeenCalled();
        });

        it('should throw when config file is not readable', async () => {
            mockExists.mockResolvedValue(true);
            mockIsFileReadable.mockResolvedValue(false);

            await expect(validateConfig('/path/to/config.json')).rejects.toThrow(ArgumentError);
            expect(mockExists).toHaveBeenCalledWith('/path/to/config.json');
            expect(mockIsFileReadable).toHaveBeenCalledWith('/path/to/config.json');
        });
    });

    describe('validateOutputDirectory', () => {
        it('should not throw when output directory exists and is writable', async () => {
            mockIsDirectoryWritable.mockResolvedValue(true);

            await expect(validateOutputDirectory('/tmp/output')).resolves.not.toThrow();
            expect(mockIsDirectoryWritable).toHaveBeenCalledWith('/tmp/output');
            expect(mockCreateDirectory).not.toHaveBeenCalled();
        });

        it('should create output directory when it does not exist', async () => {
            mockIsDirectoryWritable.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
            mockCreateDirectory.mockResolvedValue(undefined);

            await expect(validateOutputDirectory('/tmp/output')).resolves.not.toThrow();
            expect(mockIsDirectoryWritable).toHaveBeenCalledWith('/tmp/output');
            expect(mockCreateDirectory).toHaveBeenCalledWith('/tmp/output');
            // Check that isDirectoryWritable was called a second time after creating the directory
            expect(mockIsDirectoryWritable).toHaveBeenCalledTimes(2);
        });

        it('should throw when output directory creation fails', async () => {
            mockIsDirectoryWritable.mockResolvedValue(false);
            mockCreateDirectory.mockRejectedValue(new Error('Failed to create directory'));

            await expect(validateOutputDirectory('/tmp/output')).rejects.toThrow(ArgumentError);
            expect(mockIsDirectoryWritable).toHaveBeenCalledWith('/tmp/output');
            expect(mockCreateDirectory).toHaveBeenCalledWith('/tmp/output');
        });

        it('should throw when output directory is created but still not writable', async () => {
            mockIsDirectoryWritable.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
            mockCreateDirectory.mockResolvedValue(undefined);

            await expect(validateOutputDirectory('/tmp/output')).rejects.toThrow(ArgumentError);
            expect(mockIsDirectoryWritable).toHaveBeenCalledWith('/tmp/output');
            expect(mockCreateDirectory).toHaveBeenCalledWith('/tmp/output');
            expect(mockIsDirectoryWritable).toHaveBeenCalledTimes(2);
        });
    });

    describe('generateConfig', () => {
        it('should throw when start date format is invalid', async () => {
            await expect(generateConfig({
                start: '2023/01/01',
                currentMonth: false,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/tmp'
            })).rejects.toThrow(ArgumentError);
        });

        it('should throw when end date format is invalid', async () => {
            await expect(generateConfig({
                end: '2023/01/01',
                currentMonth: false,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/tmp'
            })).rejects.toThrow(ArgumentError);
        });

        it('should throw when current-month used with start/end dates', async () => {
            await expect(generateConfig({
                start: '2023-01-01',
                currentMonth: true,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/tmp'
            })).rejects.toThrow(ArgumentError);
        });

        it('should validate timezone correctly', async () => {
            await expect(generateConfig({
                currentMonth: true,
                dryRun: false,
                verbose: false,
                timezone: 'invalid-timezone',
                outputDirectory: '/tmp'
            })).rejects.toThrow(ArgumentError);
        });

        it('should validate output directory is writable', async () => {
            mockIsDirectoryWritable.mockResolvedValue(false);
            mockCreateDirectory.mockRejectedValue(new Error('Failed to create directory'));

            await expect(generateConfig({
                currentMonth: true,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/invalid-output-dir'
            })).rejects.toThrow(ArgumentError);
        });

        it('should validate credentials file if provided', async () => {
            mockExists.mockResolvedValueOnce(false);

            await expect(generateConfig({
                currentMonth: true,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/tmp',
                credentialsFile: '/nonexistent/credentials.json'
            })).rejects.toThrow(ArgumentError);
        });

        it('should validate token file if provided', async () => {
            // We need to make sure the first validation passes but the token file validation fails
            mockExists.mockImplementation(async (path: string) => {
                if (path === '/nonexistent/token.json') {
                    return false;
                }
                return true;
            });

            await expect(generateConfig({
                currentMonth: true,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/tmp',
                tokenFile: '/nonexistent/token.json'
            })).rejects.toThrow(ArgumentError);
        });

        it('should validate apiScopes if provided', async () => {
            await expect(generateConfig({
                currentMonth: true,
                dryRun: false,
                verbose: false,
                timezone: DEFAULT_TIMEZONE,
                outputDirectory: '/tmp',
                apiScopes: ['invalid-scope']
            })).rejects.toThrow(ArgumentError);
        });
    });
});
