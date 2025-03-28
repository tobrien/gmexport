import { jest } from '@jest/globals';
import { Command } from 'commander';
import dayjs from 'dayjs';
import * as Auth from '../src/auth';
import * as Config from '../src/config';
import * as Gmail from '../src/gmail';
import { calculateDateRange, CommandLineArgs, main } from '../src/main';
import { getLogger, setLogLevel } from '../src/logging';

// Mock the logging module
jest.mock('../src/logging', () => ({
    getLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }),
    setLogLevel: jest.fn()
}));

// Mock all dependencies
jest.mock('commander', () => {
    const mockCommand = jest.fn().mockImplementation(() => {
        const instance = {
            name: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            requiredOption: jest.fn().mockReturnThis(),
            version: jest.fn().mockReturnThis(),
            parse: jest.fn(),
            opts: jest.fn().mockReturnValue({
                config: 'test-config.yaml',
                output: './test-output',
                start: '2024-01-01',
                end: '2024-01-31',
                dryRun: false
            })
        };
        return instance;
    });
    return { Command: mockCommand };
});

// Mock auth module to prevent interactive prompt
jest.mock('../src/auth', () => ({
    create: jest.fn().mockReturnValue({
        authorize: jest.fn().mockResolvedValue('mock-auth-client' as unknown as never)
    })
}));

jest.mock('../src/config');
jest.mock('../src/gmail');

describe('main', () => {
    let mockAuth: any;
    let mockGmail: any;
    let mockConfig: any;
    let processExitSpy: any;
    let mockCommandInstance: any;
    let mockLogger: any;

    beforeEach(() => {
        // Get the mock Command instance
        mockCommandInstance = {
            name: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            requiredOption: jest.fn().mockReturnThis(),
            version: jest.fn().mockReturnThis(),
            parse: jest.fn(),
            opts: jest.fn().mockReturnValue({
                config: 'test-config.yaml',
                output: './test-output',
                start: '2024-01-01',
                end: '2024-01-31',
                dryRun: false
            })
        };
        (Command as jest.Mock).mockImplementation(() => mockCommandInstance);

        // Mock Auth
        mockAuth = {
            authorize: jest.fn().mockResolvedValue('mock-auth-client' as unknown as never)
        };
        (Auth.create as jest.Mock).mockReturnValue(mockAuth);

        // Mock Gmail
        mockGmail = {
            exportEmails: jest.fn().mockResolvedValue(undefined as unknown as never)
        };
        (Gmail.create as jest.Mock).mockReturnValue(mockGmail);

        // Mock Config
        mockConfig = {
            credentials: {
                credentials_file: 'test-creds.json',
                token_file: 'test-token.json'
            },
            export: {
                max_results: 1000,
                destination_dir: './test-output',
                start_date: '2024-01-01',
                end_date: '2024-01-31',
                dry_run: false
            },
            filters: {
                skip_labels: [],
                skip_emails: {
                    from: [],
                    subject: []
                }
            }
        };
        (Config.createConfig as jest.Mock).mockReturnValue(mockConfig);

        // Mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        };
        (getLogger as jest.Mock).mockReturnValue(mockLogger);

        // Spy on process.exit
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
        jest.clearAllMocks();
        processExitSpy.mockRestore();
    });

    it('should successfully execute with valid parameters', async () => {
        await main();

        expect(mockCommandInstance.name).toHaveBeenCalledWith('gmail-export');
        expect(mockCommandInstance.parse).toHaveBeenCalled();
        expect(Config.createConfig).toHaveBeenCalled();
        expect(Auth.create).toHaveBeenCalledWith(mockConfig);
        expect(mockAuth.authorize).toHaveBeenCalled();
        expect(Gmail.create).toHaveBeenCalledWith(mockConfig, 'mock-auth-client');
        expect(mockGmail.exportEmails).toHaveBeenCalled();
        expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with error for invalid date format', async () => {
        // Override the mock Command instance's opts method for this test
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            start: 'invalid-date',
            end: '2024-01-31',
            dryRun: false
        });

        await main();

        expect(mockLogger.error).toHaveBeenCalledWith('Invalid start date format. Please use YYYY-MM-DD');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit with error when end date is before start date', async () => {
        // Override the mock Command instance's opts method for this test
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            start: '2024-01-31',
            end: '2024-01-01',
            dryRun: false
        });

        await main();

        expect(mockLogger.error).toHaveBeenCalledWith('End date must be after start date');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit with error when --current-month is used with --start', async () => {
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            start: '2024-01-01',
            currentMonth: true,
            dryRun: false
        });

        await main();

        expect(mockLogger.error).toHaveBeenCalledWith('--current-month cannot be used together with --start or --end options');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit with error when --current-month is used with --end', async () => {
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            end: '2024-01-31T00:00:00.000Z',
            currentMonth: true,
            dryRun: false
        });

        await main();

        expect(mockLogger.error).toHaveBeenCalledWith('--current-month cannot be used together with --start or --end options');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should set debug level when verbose flag is used', async () => {
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            start: '2024-01-01',
            end: '2024-01-31',
            dryRun: false,
            verbose: true
        });

        await main();

        expect(setLogLevel).toHaveBeenCalledWith('debug');
    });

    describe('calculateDateRange', () => {
        beforeEach(() => {
            // Mock current date to 2024-03-15 for consistent testing
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-03-15T00:00:00.000Z'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should return start and end dates when explicitly provided', () => {
            const options = {
                start: '2024-01-01',
                end: '2024-01-31',
                currentMonth: false
            };

            const range = calculateDateRange(options as CommandLineArgs);

            expect(range.start.format()).toBe(dayjs('2024-01-01').format());
            expect(range.end.format()).toBe(dayjs('2024-01-31').format());
        });

        it('should calculate current month range when --current-month is used', () => {
            const options = {
                currentMonth: true
            };

            const range = calculateDateRange(options as CommandLineArgs);

            // For mocked date 2024-03-15, should return full March range
            expect(range.start.format()).toBe(dayjs('2024-03-01').format());
            expect(range.end.format()).toBe(dayjs('2024-03-15T00:00:00.000Z').format());
        });

        it('should use end date as today when only start date provided', () => {
            const options = {
                start: '2024-03-01',
                currentMonth: false
            };

            const range = calculateDateRange(options as CommandLineArgs);

            expect(range.start.format()).toBe(dayjs('2024-03-01').format());
            expect(range.end.format()).toBe(dayjs('2024-03-15T00:00:00.000Z').format()); // Mocked current date
        });
    });
});
