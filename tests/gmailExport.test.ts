import { jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../src/util/storage.js', () => ({
    __esModule: true,
    create: jest.fn()
}));

jest.unstable_mockModule('../src/util/dates.js', () => ({
    __esModule: true,
    create: jest.fn()
}));

jest.unstable_mockModule('../src/filter.js', () => ({
    __esModule: true,
    create: jest.fn()
}));

jest.unstable_mockModule('../src/filename.js', () => ({
    __esModule: true,
    formatFilename: jest.fn()
}));

jest.unstable_mockModule('../src/gmail/query.js', () => ({
    __esModule: true,
    createQuery: jest.fn()
}));

jest.unstable_mockModule('../src/logging.js', () => ({
    __esModule: true,
    getLogger: jest.fn()
}));

// Import modules asynchronously using dynamic imports to support ESM
let create: any;
let Storage: any;
let Dates: any;
let Filter: any;
let Filename: any;
let GmailQuery: any;
let Logger: any;
let MessageWrapper: any;

// Import constants and types using static imports which work fine
import { DATE_FORMAT_DAY, DATE_FORMAT_MONTH, DATE_FORMAT_YEAR } from '../src/constants.js';
import { Config as ExportConfig } from '../src/export.d.js';
import { DateRange } from '../src/run.js';

// Load all dynamic imports before tests
beforeAll(async () => {
    Storage = await import('../src/util/storage.js');
    Dates = await import('../src/util/dates.js');
    Filter = await import('../src/filter.js');
    Filename = await import('../src/filename.js');
    GmailQuery = await import('../src/gmail/query.js');
    Logger = await import('../src/logging.js');

    // Directly import MessageWrapper as it's a class import
    MessageWrapper = (await import('../src/gmail/MessageWrapper.js')).default;

    // Get the exported function
    const gmailExportModule = await import('../src/gmailExport.js');
    create = gmailExportModule.create;
});

describe('gmailExport', () => {
    // Mock objects
    const mockDate = new Date('2023-01-15T12:00:00Z');
    const mockStorage = {
        exists: jest.fn(),
        createDirectory: jest.fn(),
        writeFile: jest.fn()
    };
    const mockDates = {
        date: jest.fn(),
        format: jest.fn()
    };
    const mockFilter = {
        shouldSkipEmail: jest.fn()
    };
    const mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
    };

    // Simplified mock API
    const mockGetMessage = jest.fn();
    const mockListMessages = jest.fn();
    const mockApi = {
        getMessage: mockGetMessage,
        listMessages: mockListMessages
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock implementations
        Storage.create.mockReturnValue(mockStorage);
        Dates.create.mockReturnValue(mockDates);
        Filter.create.mockReturnValue(mockFilter);
        Logger.getLogger.mockReturnValue(mockLogger);
        Filename.formatFilename.mockReturnValue('email_2023-01-15.eml');
        GmailQuery.createQuery.mockReturnValue('after:2023/01/01 before:2023/01/31');

        // Default date mock behavior
        mockDates.date.mockReturnValue(mockDate);
        mockDates.format.mockImplementation((date, format) => {
            if (format === DATE_FORMAT_YEAR) return '2023';
            if (format === DATE_FORMAT_MONTH) return '01';
            if (format === DATE_FORMAT_DAY) return '15';
            return '';
        });
    });

    describe('exportEmails', () => {
        // Define test configs
        const runConfig = {
            dryRun: false,
            timezone: 'UTC'
        };

        const exportConfig: ExportConfig = {
            outputDirectory: '/export',
            outputStructure: 'year',
            filenameOptions: ['date'],
            credentialsFile: 'credentials.json',
            tokenFile: 'token.json',
            apiScopes: ['scope1'],
            filters: {
                include: {},
                exclude: {}
            }
        };

        // Create a date range compatible with DateRange type
        const dateRange: DateRange = {
            start: new Date('2023-01-01'),
            end: new Date('2023-01-31')
        };

        it('should process messages from Gmail API', async () => {
            // Set up mock implementation for listMessages to call the callback with some messages
            mockListMessages.mockImplementation(async (_params, callback) => {
                // @ts-ignore
                await callback([{ id: 'msg1' }, { id: 'msg2' }]);
            });

            // Set up getMessage to return valid message data
            mockGetMessage.mockImplementation(async (params) => {
                // @ts-ignore
                if (params.format === 'metadata') {
                    return {
                        // @ts-ignore
                        id: params.id,
                        payload: {
                            headers: [
                                { name: 'Message-ID', value: '<1234567890@example.com>' },
                                { name: 'From', value: 'test@example.com' },
                                { name: 'To', value: 'test@example.com' },
                                { name: 'Subject', value: 'Test Email' },
                                { name: 'Date', value: '2023-01-15T12:00:00Z' }
                            ]
                        }
                    };
                    // @ts-ignore
                } else if (params.format === 'raw') {
                    return {
                        // @ts-ignore
                        id: params.id,
                        raw: Buffer.from('Raw email content').toString('base64'),
                        labelIds: ['INBOX'],
                        threadId: 'thread1',
                        snippet: 'Email snippet'
                    };
                }
                return null;
            });

            // Set filter to not skip emails
            mockFilter.shouldSkipEmail.mockReturnValue({ skip: false });

            // Set file to not exist
            // @ts-ignore
            mockStorage.exists.mockResolvedValue(false);

            const exporter = create(runConfig, exportConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify the right query was created
            expect(GmailQuery.createQuery).toHaveBeenCalledWith(
                dateRange,
                exportConfig,
                runConfig.timezone
            );

            // Verify API was called correctly
            expect(mockListMessages).toHaveBeenCalledWith(
                { userId: 'me', q: 'after:2023/01/01 before:2023/01/31' },
                expect.any(Function)
            );

            // Verify each message was processed
            expect(mockGetMessage).toHaveBeenCalledTimes(4); // 2 messages x 2 calls each (metadata + raw)

            // Verify files were written
            expect(mockStorage.writeFile).toHaveBeenCalledTimes(2);

            // Verify logs were written
            expect(mockLogger.info).toHaveBeenCalledWith('Export Summary:');
        });

        it('should skip filtered emails', async () => {
            // Set up mock implementation for listMessages
            mockListMessages.mockImplementation(async (_params, callback) => {
                // @ts-ignore
                await callback([{ id: 'msg1' }]);
            });

            // Set up getMessage to return valid message data
            // @ts-ignore
            mockGetMessage.mockResolvedValueOnce({
                id: 'msg1',
                payload: {
                    headers: [
                        { name: 'Message-ID', value: '<1234567890@example.com>' },
                        { name: 'From', value: 'test@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'Test Email' },
                        { name: 'Date', value: '2023-01-15T12:00:00Z' }
                    ]
                }
            });

            // Set filter to skip emails with type casting to avoid linter errors
            mockFilter.shouldSkipEmail.mockReturnValue({
                skip: Boolean(true),
                reason: 'Filtered by rule'
            });

            const exporter = create(runConfig, exportConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify filter was called
            expect(mockFilter.shouldSkipEmail).toHaveBeenCalled();

            // Verify no raw messages were requested or files written
            expect(mockGetMessage).toHaveBeenCalledTimes(1); // Only the metadata call
            expect(mockStorage.writeFile).not.toHaveBeenCalled();

            // Verify debug log was written
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Filtered email: %s %j',
                'Filtered by rule',
                expect.anything()
            );
        });

        it('should skip existing files', async () => {
            // Set up mock implementation for listMessages
            mockListMessages.mockImplementation(async (_params, callback) => {
                // @ts-ignore
                await callback([{ id: 'msg1' }]);
            });

            // Set up getMessage to return valid message data
            // @ts-ignore
            mockGetMessage.mockResolvedValueOnce({
                id: 'msg1',
                payload: {
                    headers: [
                        { name: 'Message-ID', value: '<1234567890@example.com>' },
                        { name: 'From', value: 'test@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'Test Email' },
                        { name: 'Date', value: '2023-01-15T12:00:00Z' }
                    ]
                }
            });

            // Set filter to not skip emails with type casting to avoid linter errors
            mockFilter.shouldSkipEmail.mockReturnValue({
                skip: Boolean(false)
            });

            // Set file to already exist
            // @ts-ignore
            mockStorage.exists.mockResolvedValue(true);

            const exporter = create(runConfig, exportConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify storage.exists was called
            expect(mockStorage.exists).toHaveBeenCalled();

            // Verify no raw messages were requested or files written
            expect(mockGetMessage).toHaveBeenCalledTimes(1); // Only the metadata call
            expect(mockStorage.writeFile).not.toHaveBeenCalled();

            // Verify debug log was written
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Skipping existing file: %s',
                expect.any(String)
            );
        });

        it('should handle errors during message processing', async () => {
            // Set up mock implementation for listMessages
            mockListMessages.mockImplementation(async (_params, callback) => {
                // @ts-ignore
                await callback([{ id: 'msg1' }]);
            });

            // First, set up getMessage to succeed for the metadata call but fail for the raw call
            mockGetMessage.mockImplementationOnce(async () => ({
                id: 'msg1',
                payload: {
                    headers: [
                        { name: 'Message-ID', value: '<1234567890@example.com>' },
                        { name: 'From', value: 'test@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'Test Email' },
                        { name: 'Date', value: '2023-01-15T12:00:00Z' }
                    ]
                }
            }));

            // Second call (for raw message) will throw an error
            mockGetMessage.mockImplementationOnce(async () => {
                throw new Error('API error');
            });

            // Set filter to not skip emails
            mockFilter.shouldSkipEmail.mockReturnValue({ skip: Boolean(false) });

            // Set file to not exist so we proceed to raw message fetch
            // @ts-ignore
            mockStorage.exists.mockResolvedValue(false);

            const exporter = create(runConfig, exportConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error processing message %s: %s',
                'msg1',
                expect.any(Error)
            );

            // Verify no files were written
            expect(mockStorage.writeFile).not.toHaveBeenCalled();
        });

        it('should indicate dry run mode', async () => {
            const dryRunConfig = {
                ...runConfig,
                dryRun: true
            };

            mockListMessages.mockImplementation(async (_params, callback) => {
                // @ts-ignore
                await callback([]);
            });

            const exporter = create(dryRunConfig, exportConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify dry run message was logged
            expect(mockLogger.info).toHaveBeenCalledWith('This was a dry run. No files were actually saved.');
        });

        it('should print summary information after export', async () => {
            // Set up mock implementation for listMessages to call the callback without messages
            mockListMessages.mockImplementation(async (_params, callback) => {
                // @ts-ignore
                await callback([]);
            });

            const exporter = create(runConfig, exportConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify summary logs were written in the expected format
            expect(mockLogger.info).toHaveBeenCalledWith('Export Summary:');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Total messages found: 0'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully processed: 0'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Skipped (already exists): 0'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Filtered out: 0'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Errors: 0'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Dry run mode: No'));
        });
    });
});
