import { jest } from '@jest/globals';
import { OutputStructure, FilenameOption } from '@tobrien/cabazooka';

// Import types needed before mocking
import { Config, InputParameters, ConfigError as ActualConfigError } from '../src/run.js';

// --- Mock Definitions ---
const mockDateUtility = {
    now: jest.fn<() => Date>(),
    date: jest.fn<(d?: Date | string | number | null) => Date>().mockImplementation(d => new Date(d || 0)), // Provide a basic implementation
    startOfMonth: jest.fn<() => Date>(),
    subDays: jest.fn<(d: Date, n: number) => Date>(),
    isBefore: jest.fn<(d1: Date, d2: Date) => boolean>(),
    format: jest.fn<(d: Date, f: string) => string>(),
};
const mockStorageInstance = {
    readFile: jest.fn<() => Promise<string>>(),
    isDirectoryWritable: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    isFileReadable: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
};
const mockLoggerInstance = {
    info: jest.fn<() => void>(),
    debug: jest.fn<() => void>(),
    error: jest.fn<() => void>(),
    warn: jest.fn<() => void>(),
};
const mockYamlFunctions = {
    load: jest.fn<() => any>().mockReturnValue({}),
};
const mockGeneralFunctions = {
    deepMerge: jest.fn().mockImplementation((a: any, b: any) => ({ ...(a as object), ...(b as object) })),
};

// --- Mock Module Setup ---
jest.unstable_mockModule('../src/util/dates.js', () => ({
    create: jest.fn().mockReturnValue(mockDateUtility),
}));
jest.unstable_mockModule('../src/util/storage.js', () => ({
    create: jest.fn().mockReturnValue(mockStorageInstance),
}));
jest.unstable_mockModule('js-yaml', () => mockYamlFunctions);
jest.unstable_mockModule('../src/util/general.js', () => mockGeneralFunctions);
jest.unstable_mockModule('../src/logging.js', () => ({
    getLogger: jest.fn().mockReturnValue(mockLoggerInstance),
}));

// --- Dynamic Imports (after mocks) ---
// Import the module to test *after* mocks
const Run = await import('../src/run.js');
const Dates = await import('../src/util/dates.js');
const Storage = await import('../src/util/storage.js');
const yaml = await import('js-yaml');
const General = await import('../src/util/general.js');
const Logging = await import('../src/logging.js');

// --- Assign Mocks & Actuals ---
const mockDatesCreate = Dates.create as jest.Mock;
const mockStorageCreate = Storage.create as jest.Mock;
const mockYamlLoad = yaml.load as jest.Mock;
const mockGeneralDeepMerge = General.deepMerge as jest.Mock;
const mockGetLogger = Logging.getLogger as jest.Mock;

// Get the actual implementation from the dynamically imported module
const createConfig = Run.createConfig;
const ConfigError = Run.ConfigError;


// Define some default values needed for merged config
const MOCK_DEFAULTS: Partial<Config> = { // Use Config from dynamic import
    outputDirectory: '/mock/output',
    outputStructure: 'flat' as OutputStructure,
    filenameOptions: ['date' as FilenameOption],
    credentialsFile: '/mock/credentials.json',
    tokenFile: '/mock/token.json',
    apiScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    timezone: 'UTC',
    dryRun: false,
    verbose: false,
    filters: { exclude: {}, include: {} },
};

describe('run', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks before each test using assigned variables
        mockDatesCreate.mockReturnValue(mockDateUtility);
        mockStorageCreate.mockReturnValue(mockStorageInstance);
        mockYamlLoad.mockReturnValue({});
        mockGeneralDeepMerge.mockImplementation((a: any, b: any) => ({ ...(a as object), ...(b as object) }));
        mockGetLogger.mockReturnValue(mockLoggerInstance);
        // Reset mock instance method defaults
        mockStorageInstance.isDirectoryWritable.mockResolvedValue(true);
        mockStorageInstance.isFileReadable.mockResolvedValue(true);
        // Add more robust default date mocks to prevent errors in paths before validation
        mockDateUtility.date.mockImplementation((d) => new Date(d || '2023-01-01T00:00:00Z'));
        mockDateUtility.now.mockReturnValue(new Date('2023-01-15T12:00:00Z'));
        mockDateUtility.startOfMonth.mockReturnValue(new Date('2023-01-01T00:00:00Z'));
        mockDateUtility.subDays.mockImplementation((d, n) => {
            const base = d instanceof Date ? d : new Date('2023-01-15T12:00:00Z');
            const newDate = new Date(base);
            newDate.setDate(newDate.getDate() - n);
            return newDate;
        });
        mockDateUtility.isBefore.mockReturnValue(false); // Default to false unless overridden
    });

    describe('ConfigError', () => {
        it('should create error with correct name and message', () => {
            const error = new ConfigError('Test error');
            expect(error.name).toBe('ConfigurationError');
            expect(error.message).toBe('Test error');
        });
    });

    describe('createConfig', () => {

        // Helper to create default InputParameters
        const createMockInputParams = (overrides: Partial<InputParameters> = {}): InputParameters => {
            // Base structure similar to MOCK_DEFAULTS but for InputParameters
            const base: Partial<InputParameters> = {
                outputDirectory: MOCK_DEFAULTS.outputDirectory,
                outputStructure: 'flat' as OutputStructure,
                filenameOptions: ['date' as FilenameOption],
                timezone: MOCK_DEFAULTS.timezone,
                dryRun: MOCK_DEFAULTS.dryRun,
                verbose: MOCK_DEFAULTS.verbose,
                currentMonth: false,
                // Fields specific to InputParameters not in base Config
                configFile: undefined,
                start: undefined,
                end: undefined,
                apiScopes: MOCK_DEFAULTS.apiScopes,
                credentialsFile: MOCK_DEFAULTS.credentialsFile,
                tokenFile: MOCK_DEFAULTS.tokenFile,
                // Ensure all keys from InputParameters are considered
            };
            return { ...base, ...overrides } as InputParameters; // Use imported type
        };

        it('should create config with current month range and merged defaults', async () => {
            const now = new Date('2023-07-15T12:00:00Z');
            const startOfMonth = new Date('2023-07-01T00:00:00Z');

            mockDateUtility.now.mockReturnValue(now);
            mockDateUtility.startOfMonth.mockReturnValue(startOfMonth);
            mockDateUtility.isBefore.mockReturnValue(false);

            const inputParams = createMockInputParams({
                timezone: 'America/New_York',
                currentMonth: true,
                dryRun: true,
            });

            const result = await createConfig(inputParams);

            expect(mockDatesCreate).toHaveBeenCalledWith({ timezone: 'America/New_York' });
            expect(result).toEqual(expect.objectContaining({
                ...MOCK_DEFAULTS,
                dateRange: {
                    start: startOfMonth,
                    end: now,
                },
                dryRun: true,
                timezone: 'America/New_York',
            }));
            expect(mockStorageInstance.isDirectoryWritable).toHaveBeenCalledWith(MOCK_DEFAULTS.outputDirectory);
            expect(mockStorageInstance.isFileReadable).toHaveBeenCalledWith(MOCK_DEFAULTS.credentialsFile);
        });

        it('should load config from file and merge with params', async () => {
            const fileConfig = {
                outputDirectory: '/file/output',
                filters: { include: { from: ['test@example.com'] } },
            };
            mockYamlLoad.mockReturnValue(fileConfig);
            mockStorageInstance.readFile.mockResolvedValue('yaml: content');

            const start = new Date('2023-06-01T00:00:00Z');
            const end = new Date('2023-06-30T23:59:59Z');
            // Mock date utility specifically for start/end parsing in this test
            mockDateUtility.date.mockImplementation(d => d instanceof Date ? d : new Date(d || 0));
            mockDateUtility.isBefore.mockReturnValue(false);

            const inputParams = createMockInputParams({
                configFile: 'config.yaml',
                start: start,
                end: end,
                timezone: 'Europe/London', // Param override
                outputDirectory: undefined, // <-- Add this line to avoid conflict
            });

            const result = await createConfig(inputParams);

            expect(mockStorageInstance.readFile).toHaveBeenCalledWith('config.yaml', expect.any(String));
            expect(mockYamlLoad).toHaveBeenCalledWith('yaml: content');
            expect(mockGeneralDeepMerge).toHaveBeenCalled();

            expect(result).toEqual(expect.objectContaining({
                ...MOCK_DEFAULTS,
                outputDirectory: '/file/output', // From file
                timezone: 'Europe/London', // From param
                filters: { include: { from: ['test@example.com'] } }, // Adjusted for shallow mock merge
                dateRange: { start, end },
            }));
            expect(mockStorageInstance.isDirectoryWritable).toHaveBeenCalledWith('/file/output');
        });

        it('should throw error if required file is not readable', async () => {
            mockStorageInstance.isFileReadable.mockResolvedValue(false);
            const inputParams = createMockInputParams({
                credentialsFile: '/unreadable/creds.json'
            });

            await expect(createConfig(inputParams)).rejects.toThrow(ConfigError);
            await expect(createConfig(inputParams)).rejects.toThrow(/File is not readable: \/unreadable\/creds.json/);
            expect(mockStorageInstance.isFileReadable).toHaveBeenCalledWith('/unreadable/creds.json');
        });

        it('should throw error if output directory is not writeable', async () => {
            mockStorageInstance.isDirectoryWritable.mockResolvedValue(false);
            const inputParams = createMockInputParams({
                outputDirectory: '/unwritable/dir'
            });

            await expect(createConfig(inputParams)).rejects.toThrow(ConfigError);
            await expect(createConfig(inputParams)).rejects.toThrow(/Directory is not writeable: \/unwritable\/dir/);
            expect(mockStorageInstance.isDirectoryWritable).toHaveBeenCalledWith('/unwritable/dir');
        });

        it('should throw ConfigError when end date is before start date', async () => {
            const start = new Date('2023-07-15T00:00:00Z');
            const end = new Date('2023-07-10T00:00:00Z');
            mockDateUtility.isBefore.mockReturnValue(true);
            const inputParams = createMockInputParams({ start, end });

            // Mock date utility specifically for start/end parsing in this test
            mockDateUtility.date.mockImplementation(d => d instanceof Date ? d : new Date(d || 0));

            await expect(createConfig(inputParams)).rejects.toThrow(ConfigError);
            await expect(createConfig(inputParams)).rejects.toThrow(/End date .* must be on or after start date/);
        });

        it('should throw error for invalid API scope', async () => {
            const inputParams = createMockInputParams({
                apiScopes: ['invalid-scope']
            });
            await expect(createConfig(inputParams)).rejects.toThrow(ConfigError);
            await expect(createConfig(inputParams)).rejects.toThrow(/Invalid API scope: invalid-scope/);
        });

        it('should throw error if config file specified but unreadable', async () => {
            mockStorageInstance.readFile.mockRejectedValue(new Error('Read permission denied'));
            const inputParams = createMockInputParams({ configFile: 'bad_config.yaml' });
            await expect(createConfig(inputParams)).rejects.toThrow(ConfigError);
            await expect(createConfig(inputParams)).rejects.toThrow(/Failed to load or parse configuration file bad_config.yaml: Read permission denied/);
        });

        it('should throw error on config conflict', async () => {
            const fileConfig = { outputDirectory: '/file/output' };
            mockYamlLoad.mockReturnValue(fileConfig);
            mockStorageInstance.readFile.mockResolvedValue('yaml: content');
            const inputParams = createMockInputParams({
                configFile: 'config.yaml',
                outputDirectory: '/param/output' // Conflict
            });
            await expect(createConfig(inputParams)).rejects.toThrow(ConfigError);
            await expect(createConfig(inputParams)).rejects.toThrow(/Conflicting settings for 'output directory' detected./);
        });

        it('should create config with default end date when not provided', async () => {
            const start = new Date('2023-06-01T00:00:00Z');
            const now = new Date('2023-06-15T12:00:00Z');
            mockDateUtility.now.mockReturnValue(now);
            mockDateUtility.isBefore.mockReturnValue(false);
            const inputParams = createMockInputParams({ start });
            const result = await createConfig(inputParams);
            expect(result.dateRange.start).toEqual(start);
            expect(result.dateRange.end).toEqual(now);
        });

        it('should create config with default start date when not provided', async () => {
            const end = new Date('2023-06-30T23:59:59Z');
            const calculatedStart = new Date('2023-05-30T23:59:59Z');
            mockDateUtility.subDays.mockReturnValue(calculatedStart);
            mockDateUtility.isBefore.mockReturnValue(false);
            const inputParams = createMockInputParams({ end });
            const result = await createConfig(inputParams);
            expect(mockDateUtility.subDays).toHaveBeenCalledWith(end, 31);
            expect(result.dateRange.start).toEqual(calculatedStart);
            expect(result.dateRange.end).toEqual(end);
        });
    });
});
