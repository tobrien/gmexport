import { jest } from '@jest/globals';
import { Command } from 'commander';
import dayjs from 'dayjs';
import * as Config from '../src/config.js';
import * as GmailExport from '../src/gmailExport.js';
import * as Auth from '../src/gmail/auth.js';
import { getLogger, setLogLevel } from '../src/logging.js';
import { calculateDateRange, logDetailedConfiguration, logExportConfiguration, main } from '../src/main.js';
import { CommandLineArgs, Configuration } from '../src/types.js';
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
jest.mock('../src/gmail/auth', () => ({
    create: jest.fn().mockReturnValue({
        authorize: jest.fn().mockResolvedValue('mock-auth-client' as unknown as never)
    })
}));

jest.mock('../src/config');
jest.mock('../src/gmailExport');

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
        (GmailExport.create as jest.Mock).mockReturnValue(mockGmail);

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
        (Config.createConfiguration as jest.Mock).mockReturnValue(mockConfig);

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
        expect(Config.createConfiguration).toHaveBeenCalled();
        expect(Auth.create).toHaveBeenCalledWith(mockConfig);
        expect(mockAuth.authorize).toHaveBeenCalled();
        expect(GmailExport.create).toHaveBeenCalledWith(mockConfig, expect.objectContaining({ listLabels: expect.any(Function), getMessage: expect.any(Function), listMessages: expect.any(Function), getAttachment: expect.any(Function) }));
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

            expect(dayjs(range.start).format()).toBe(dayjs('2024-01-01').format());
            expect(dayjs(range.end).format()).toBe(dayjs('2024-01-31').format());
        });

        it('should calculate current month range when --current-month is used', () => {
            const options = {
                currentMonth: true
            };

            const range = calculateDateRange(options as CommandLineArgs);

            // For mocked date 2024-03-15, should return full March range
            expect(dayjs(range.start).format()).toBe(dayjs('2024-03-01').format());
            expect(dayjs(range.end).format()).toBe(dayjs('2024-03-15T00:00:00.000Z').format());
        });

        it('should use end date as today when only start date provided', () => {
            const options = {
                start: '2024-03-01',
                currentMonth: false
            };

            const range = calculateDateRange(options as CommandLineArgs);

            expect(dayjs(range.start).format()).toBe(dayjs('2024-03-01').format());
            expect(dayjs(range.end).format()).toBe(dayjs('2024-03-15T00:00:00.000Z').format()); // Mocked current date
        });
    });

    describe('logExportConfiguration', () => {
        it('should log export configuration with correct format', () => {
            const options = {
                config: 'test-config.yaml',
                output: './test-output',
                start: '2024-01-01',
                end: '2024-01-31',
                dryRun: false
            } as CommandLineArgs;

            const dateRange = {
                start: dayjs('2024-01-01').toDate(),
                end: dayjs('2024-01-31').toDate()
            };

            logExportConfiguration(options, './test-output', dateRange);

            expect(mockLogger.info).toHaveBeenCalledWith('Export Configuration:');
            expect(mockLogger.info).toHaveBeenCalledWith('\tConfig File: test-config.yaml');
            expect(mockLogger.info).toHaveBeenCalledWith('\tDate Range:');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tStart: 2024-01-01');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tEnd: 2024-01-31');
        });
    });

    describe('logDetailedConfiguration', () => {
        it('should log detailed configuration with correct format', () => {
            const config = {
                credentials: {
                    credentials_file: 'test-creds.json',
                    token_file: 'test-token.json'
                },
                export: {
                    max_results: 1000,
                    destination_dir: './test-output'
                },
                filters: {
                    include: {
                        labels: ['INBOX', 'SENT'],
                        from: ['test@example.com'],
                        to: ['recipient@example.com'],
                        subject: ['Test Subject']
                    },
                    exclude: {
                        labels: ['SPAM'],
                        from: ['spam@example.com'],
                        to: ['blocked@example.com'],
                        subject: ['Spam Subject']
                    }
                }
            } as Configuration;

            logDetailedConfiguration(config);

            expect(mockLogger.info).toHaveBeenCalledWith('Detailed Configuration:');
            expect(mockLogger.info).toHaveBeenCalledWith('\tCredentials:');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tCredentials File: test-creds.json');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tToken File: test-token.json');
            expect(mockLogger.info).toHaveBeenCalledWith('\tExport Settings:');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tMax Results: 1000');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tDestination: ./test-output');
            expect(mockLogger.info).toHaveBeenCalledWith('\tFilters:');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tInclude:');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tLabels: INBOX, SENT');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tFrom: test@example.com');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tTo: recipient@example.com');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tSubject: Test Subject');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\tExclude:');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tLabels: SPAM');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tFrom: spam@example.com');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tTo: blocked@example.com');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tSubject: Spam Subject');
        });

        it('should handle empty or undefined filter values', () => {
            const config = {
                credentials: {
                    credentials_file: 'test-creds.json',
                    token_file: 'test-token.json'
                },
                export: {
                    max_results: 1000,
                    destination_dir: './test-output'
                },
                filters: {
                    include: {},
                    exclude: {}
                }
            } as Configuration;

            logDetailedConfiguration(config);

            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tLabels: none');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tFrom: none');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tTo: none');
            expect(mockLogger.info).toHaveBeenCalledWith('\t\t\tSubject: none');
        });
    });
});
