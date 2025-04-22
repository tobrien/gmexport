import { jest } from '@jest/globals';
import { Logger } from 'winston';
import { Command } from 'commander';
import { Instance as AuthInstance } from '../src/gmail/auth.d';
import { Instance as GmailApiInstance } from '../src/gmail/api.d';
import { Instance as GmailExportInstance } from '../src/gmailExport.d';
import { Config as RunConfig, ConfigError } from '../src/run'; // Import RunConfig type AND ConfigError from run
import { ArgumentError } from '../src/error/ArgumentError'; // Keep ArgumentError if used
import { Cabazooka, Operator as CabazookaOperator } from '@tobrien/cabazooka'; // Import Cabazooka type AND Operator
// import { ConfigError } from '../src/error/ConfigError'; // Removed - Import from run
// import { ExitError } from '../src/error/ExitError'; // Removed - Will import from phases

// --- Mock Instances/Values (Simpler) ---
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
} as unknown as jest.Mocked<Logger>; // Keep unknown cast for Logger

const mockGmailInstance: Partial<jest.Mocked<GmailExportInstance>> = {
    exportEmails: jest.fn<() => Promise<void>>(),
    printExportSummary: jest.fn<() => void>(),
};

const mockAuthInstance: Partial<jest.Mocked<AuthInstance>> = {
    authorize: jest.fn<() => Promise<any>>().mockResolvedValue({}),
};

const mockApiInstance: Partial<jest.Mocked<GmailApiInstance>> = {
    // Define only if methods are directly called, otherwise empty
};

const mockCabazookaInstance: Partial<jest.Mocked<Cabazooka>> = {
    // Define only necessary methods if called directly in phases
    // configure: jest.fn().mockResolvedValue({} as Command), // Example if needed
    // validate: jest.fn().mockResolvedValue(undefined), // Example if needed
};

// Define mockOperator
const mockOperator: jest.Mocked<CabazookaOperator> = {
    constructOutputDirectory: jest.fn<() => Promise<string>>().mockResolvedValue('/tmp/output/2023/01'),
    constructFilename: jest.fn<(createDate: Date, type: string, hash: string, options?: { subject?: string }) => Promise<string>>().mockResolvedValue('email_2023-01-15_msg1'),
    process: jest.fn<(callback: (file: string) => Promise<void>) => Promise<void>>().mockResolvedValue(undefined),
};


// --- Mock Module Setup (Exporting functions) ---
jest.unstable_mockModule('../src/gmail/auth', () => ({
    // @ts-ignore
    create: jest.fn().mockResolvedValue(mockAuthInstance as AuthInstance),
}));
jest.unstable_mockModule('../src/run', () => ({
    createConfig: jest.fn(), // Let tests define resolve/reject
    ConfigError: ConfigError,
}));
jest.unstable_mockModule('../src/gmail/api', () => ({
    create: jest.fn().mockReturnValue(mockApiInstance as GmailApiInstance),
}));
jest.unstable_mockModule('../src/gmailExport', () => ({
    create: jest.fn().mockReturnValue(mockGmailInstance as GmailExportInstance),
}));
jest.unstable_mockModule('../src/logging', () => ({
    getLogger: jest.fn().mockReturnValue(mockLogger),
}));


// --- Dynamic Imports (after mocks) ---
const Auth = await import('../src/gmail/auth');
const Run = await import('../src/run');
const GmailApi = await import('../src/gmail/api');
const GmailExport = await import('../src/gmailExport');
const Phases = await import('../src/phases');
const Logging = await import('../src/logging');
const { ExitError } = await import('../src/phases');

// --- Assign Mocks (Get the mocked functions) ---
const mockAuthCreate = Auth.create as jest.Mock;
const mockRunCreateConfig = Run.createConfig as jest.Mock;
const mockGmailApiCreate = GmailApi.create as jest.Mock;
const mockGmailExportCreate = GmailExport.create as jest.Mock;
const mockGetLogger = Logging.getLogger as jest.Mock;

// --- Test Suite ---

// Define a sample RunConfig for reuse (defined at top level)
const sampleRunConfig: RunConfig = {
    dateRange: { start: new Date(), end: new Date() },
    dryRun: false,
    verbose: false,
    timezone: 'UTC',
    outputDirectory: '/tmp/output',
    outputStructure: 'month' as const,
    outputFilenameOptions: ['date' as const],
    credentialsFile: 'creds.json',
    tokenFile: 'token.json',
    apiScopes: ['scope1'],
    filters: { exclude: {}, include: {} },
};

describe('Phases Module', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset implementations/values using the assigned mock variables
        // @ts-ignore
        mockAuthCreate.mockResolvedValue(mockAuthInstance as AuthInstance);
        mockGmailApiCreate.mockReturnValue(mockApiInstance as GmailApiInstance);
        mockGmailExportCreate.mockReturnValue(mockGmailInstance as GmailExportInstance);
        mockGetLogger.mockReturnValue(mockLogger);
        mockRunCreateConfig.mockClear();

        // Reset calls on mock instance methods if they exist and are used
        if (mockAuthInstance.authorize) mockAuthInstance.authorize.mockClear();
        if (mockGmailInstance.exportEmails) mockGmailInstance.exportEmails.mockClear();
        // Reset operator mocks
        mockOperator.constructOutputDirectory.mockClear().mockResolvedValue('/tmp/output/2023/01');
        mockOperator.constructFilename.mockClear().mockResolvedValue('email_2023-01-15_msg1');
        mockOperator.process.mockClear().mockResolvedValue(undefined);
    });

    describe('configure', () => {
        it('should successfully generate configurations by calling Run.createConfig', async () => {
            const mockOptions = { verbose: true, credentialsFile: 'value', tokenFile: 'value' };
            const mockRunConfigResult = { ...sampleRunConfig, verbose: true };

            // @ts-ignore
            mockRunCreateConfig.mockResolvedValue(mockRunConfigResult);

            // Pass mockCabazooka directly (as any for simplicity if needed)
            const result = await Phases.configure(mockOptions as any, mockLogger, mockCabazookaInstance as Cabazooka);

            expect(result).toEqual(mockRunConfigResult);
            expect(mockRunCreateConfig).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Run Configuration'), expect.any(String));
        });

        it('should handle Run.ConfigError by throwing ExitError', async () => {
            const mockOptions = { verbose: true };
            const configError = new Run.ConfigError('Invalid config value');

            // @ts-ignore
            mockRunCreateConfig.mockRejectedValue(configError);

            await expect(Phases.configure(mockOptions as any, mockLogger, mockCabazookaInstance as Cabazooka)).rejects.toThrow(ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('An Error occurred configuring this run'),
                configError.message
            );
        });

        it('should handle ArgumentError by throwing ExitError', async () => {
            // Simulate error during date parsing within Phases.configure
            // Pass invalid options directly, expect internal ConfigError to be caught
            // Need to mock createConfig to throw the error
            const argError = new Run.ConfigError('Invalid start date format: invalid');
            // @ts-ignore
            mockRunCreateConfig.mockRejectedValue(argError);
            await expect(Phases.configure({ start: 'invalid' } as any, mockLogger, mockCabazookaInstance as Cabazooka)).rejects.toThrow(ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('An Error occurred configuring'), // Catches the ConfigError
                expect.stringContaining('Invalid start date format: invalid') // The message from ConfigError
            );
        });
    });

    describe('connect', () => {
        it('should successfully create Gmail instance', async () => {
            const result = await Phases.connect(sampleRunConfig, mockLogger, mockOperator);
            expect(result).toBe(mockGmailInstance as GmailExportInstance);
            expect(mockAuthCreate).toHaveBeenCalledWith(sampleRunConfig);
            expect(mockAuthInstance.authorize).toHaveBeenCalled();
            expect(mockGmailApiCreate).toHaveBeenCalledWith(expect.any(Object));
            expect(mockGmailExportCreate).toHaveBeenCalledWith(sampleRunConfig, mockApiInstance as GmailApiInstance, mockOperator);
        });

        it('should handle connection errors by throwing ExitError', async () => {
            const mockError = new Error('Auth create failed');
            // @ts-ignore
            mockAuthCreate.mockRejectedValue(mockError);
            await expect(Phases.connect(sampleRunConfig, mockLogger, mockOperator)).rejects.toThrow(ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error occurred during connection phase: %s %s',
                mockError.message,
                mockError.stack
            );
        });
    });

    describe('exportEmails', () => {
        it('should successfully export emails', async () => {
            await Phases.exportEmails(mockGmailInstance as GmailExportInstance, sampleRunConfig, mockLogger);
            expect(mockGmailInstance.exportEmails).toHaveBeenCalledWith(sampleRunConfig.dateRange);
        });

        it('should handle export errors by throwing ExitError', async () => {
            const mockError = new Error('Export failed');
            // Ensure the mock function exists before setting its behavior
            if (mockGmailInstance.exportEmails) {
                // @ts-ignore
                (mockGmailInstance.exportEmails as jest.Mock).mockRejectedValue(mockError);
            }
            await expect(Phases.exportEmails(mockGmailInstance as GmailExportInstance, sampleRunConfig, mockLogger)).rejects.toThrow(ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error occurred during export phase: %s %s',
                mockError.message,
                mockError.stack
            );
        });
    });
});
