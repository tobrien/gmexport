import { Instance as AuthInstance } from '../src/gmail/auth.d';
import { Instance as GmailApiInstance } from '../src/gmail/api.d';

const mockAuth = {
    // @ts-ignore
    authorize: jest.fn().mockResolvedValue({}),
} as unknown as AuthInstance;

jest.unstable_mockModule('../src/gmail/auth', () => ({
    __esModule: true,
    // @ts-ignore
    create: jest.fn().mockResolvedValue(mockAuth),
}));

jest.unstable_mockModule('../src/arguments', () => ({
    __esModule: true,
    generateConfig: jest.fn(),
    ArgumentError: jest.fn(),
}));

jest.unstable_mockModule('../src/gmail/api', () => ({
    __esModule: true,
    create: jest.fn(),
}));

jest.unstable_mockModule('../src/gmailExport', () => ({
    __esModule: true,
    create: jest.fn(),
}));

let Auth: any;
let Arguments: any;
let GmailApi: any;
let GmailExport: any;
let Phases: any;

import { jest } from '@jest/globals';
import { Command } from 'commander';
import { ArgumentError } from 'error/ArgumentError';
import { Logger } from 'winston';
import { Instance as GmailExportInstance } from '../src/gmailExport.d';
// Mock all external dependencies
jest.mock('commander');
jest.mock('../src/run');
jest.mock('../src/export');

describe('Phases Module', () => {
    let mockLogger: jest.Mocked<Logger>;
    let mockGmailInstance: jest.Mocked<GmailExportInstance>;
    let mockAuthInstance: jest.Mocked<AuthInstance>;
    let mockApi: jest.Mocked<GmailApiInstance>;
    let mockProgram: jest.Mocked<Command>;

    beforeEach(async () => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        Auth = await import('../src/gmail/auth');
        Arguments = await import('../src/arguments');
        GmailApi = await import('../src/gmail/api');
        GmailExport = await import('../src/gmailExport');
        Phases = await import('../src/phases');

        // Setup mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
        } as any;

        // Setup mock Gmail instance
        mockGmailInstance = {
            exportEmails: jest.fn(),
        } as any;

        // Setup mock auth instance
        mockAuthInstance = {
            authorize: jest.fn(),
        } as any;

        // Setup mock API
        mockApi = {} as any;

        // Setup mock program
        mockProgram = {
            parse: jest.fn(),
            opts: jest.fn(),
        } as any;
    });

    describe('configure', () => {
        it('should successfully generate configurations', async () => {
            const mockOptions = { verbose: true, credentialsFile: 'value', tokenFile: 'value' };
            const mockRunConfig = { someConfig: 'value' };
            const mockExportConfig = { exportConfig: 'value' };

            // @ts-ignore
            (Arguments.generateConfig as jest.Mock).mockResolvedValue([mockRunConfig, mockExportConfig]);

            // @ts-ignore
            const result = await Phases.configure(mockOptions, mockLogger);

            expect(result).toEqual({
                exportConfig: mockExportConfig,
                runConfig: mockRunConfig,
            });
            expect(Arguments.generateConfig).toHaveBeenCalledWith(mockOptions);
            expect(mockLogger.info).toHaveBeenCalledTimes(2);
        });

        it('should handle ArgumentError by throwing ExitError', async () => {
            const mockOptions = { verbose: true };
            const mockError = new ArgumentError('test', 'test message');

            // @ts-ignore
            (Arguments.generateConfig as jest.Mock).mockRejectedValue(mockError);

            // @ts-ignore
            await expect(Phases.configure(mockOptions, mockLogger)).rejects.toThrow(Phases.ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith('There was an error with a command line argument');
        });
    });

    describe('connect', () => {
        it('should successfully create Gmail instance', async () => {
            const mockExportConfig = { exportConfig: 'value' };
            const mockRunConfig = { runConfig: 'value' };

            // @ts-ignore
            (Auth.create as jest.Mock).mockResolvedValue(mockAuthInstance);

            // @ts-ignore
            mockAuthInstance.authorize.mockResolvedValue({});
            // @ts-ignore
            (GmailApi.create as jest.Mock).mockReturnValue(mockApi);
            // @ts-ignore
            (GmailExport.create as jest.Mock).mockReturnValue(mockGmailInstance);

            // @ts-ignore
            const result = await Phases.connect(mockExportConfig, mockRunConfig, mockLogger);

            expect(result).toBe(mockGmailInstance);
            expect(Auth.create).toHaveBeenCalledWith(mockExportConfig);
            expect(GmailExport.create).toHaveBeenCalledWith(mockRunConfig, mockExportConfig, mockApi);
        });

        it('should handle connection errors by throwing ExitError', async () => {
            const mockExportConfig = { exportConfig: 'value' };
            const mockRunConfig = { runConfig: 'value' };
            const mockError = new Error('Connection failed');

            // @ts-ignore
            (Auth.create as jest.Mock).mockRejectedValue(mockError);

            // @ts-ignore
            await expect(Phases.connect(mockExportConfig, mockRunConfig, mockLogger)).rejects.toThrow(Phases.ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error occurred during connection phase: %s %s',
                mockError.message,
                mockError.stack
            );
        });
    });

    describe('exportEmails', () => {
        it('should successfully export emails', async () => {
            const mockDateRange = { start: new Date(), end: new Date() };
            mockGmailInstance.exportEmails.mockResolvedValue(undefined);

            // @ts-ignore
            await Phases.exportEmails(mockGmailInstance, { dateRange: mockDateRange }, mockLogger);

            expect(mockGmailInstance.exportEmails).toHaveBeenCalledWith(mockDateRange);
        });

        it('should handle export errors by throwing ExitError', async () => {
            const mockDateRange = { start: new Date(), end: new Date() };
            const mockError = new Error('Export failed');
            mockGmailInstance.exportEmails.mockRejectedValue(mockError);

            // @ts-ignore
            await expect(Phases.exportEmails(mockGmailInstance, { dateRange: mockDateRange }, mockLogger)).rejects.toThrow(Phases.ExitError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error occurred during export phase: %s %s',
                mockError.message,
                mockError.stack
            );
        });
    });
});
