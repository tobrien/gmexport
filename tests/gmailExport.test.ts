import { jest } from '@jest/globals';

// Import types needed
import { Config as RunConfig, DateRange } from '../src/run'; // Import RunConfig
import { Instance as GmailApiInstance } from '../src/gmail/api.d';
// import { Instance as GmailExportInstance } from '../src/gmailExport.d'; // Type only, might not be needed directly for mocks
import { DATE_FORMAT_DAY, DATE_FORMAT_MONTH, DATE_FORMAT_YEAR } from '../src/constants';
// import MessageWrapper from '../src/gmail/MessageWrapper'; // Import type if needed, actual class mocked
import { OutputStructure, FilenameOption } from '@tobrien/cabazooka';

// --- Mock Definitions ---
const mockStorageInstance = {
    exists: jest.fn<() => Promise<boolean>>(),
    createDirectory: jest.fn<() => Promise<void>>(),
    writeFile: jest.fn<() => Promise<void>>(),
};
const mockDate = new Date('2023-01-15T12:00:00Z');
const mockDatesInstance = {
    date: jest.fn<(d: string) => Date>().mockReturnValue(mockDate),
    format: jest.fn<(d: Date, fmt: string) => string>(),
};
const mockFilterInstance = {
    shouldSkipEmail: jest.fn<() => { skip: boolean; reason?: string }>(),
};
const mockFilenameFunctions = {
    formatFilename: jest.fn<() => string>().mockReturnValue('default_filename.eml'),
};
const mockGmailQueryFunctions = {
    createQuery: jest.fn<() => string>().mockReturnValue('default_query'),
    printGmailQueryInfo: jest.fn<() => void>(), // Add if used
};
const mockLoggerInstance = {
    info: jest.fn<() => void>(),
    debug: jest.fn<() => void>(),
    error: jest.fn<() => void>(),
    warn: jest.fn<() => void>(),
};
// Mock for the MessageWrapper class itself (the constructor)
const mockMessageWrapperInstance = {
    date: '2023-01-15T12:00:00Z',
    subject: 'Mock Subject',
    // Add other methods/properties accessed by the code if necessary
};
const MockMessageWrapper = jest.fn().mockImplementation(() => mockMessageWrapperInstance);

// --- Mock Module Setup --- using unstable_mockModule
jest.unstable_mockModule('../src/util/storage.js', () => ({
    create: jest.fn(() => mockStorageInstance),
}));
jest.unstable_mockModule('../src/util/dates.js', () => ({
    create: jest.fn(() => mockDatesInstance),
}));
jest.unstable_mockModule('../src/filter.js', () => ({
    create: jest.fn(() => mockFilterInstance),
}));
jest.unstable_mockModule('../src/filename.js', () => mockFilenameFunctions);
jest.unstable_mockModule('../src/gmail/query.js', () => mockGmailQueryFunctions);
jest.unstable_mockModule('../src/logging.js', () => ({
    getLogger: jest.fn(() => mockLoggerInstance),
}));
jest.unstable_mockModule('../src/gmail/MessageWrapper.js', () => ({
    default: MockMessageWrapper,
}));

// Dynamically import modules AFTER mocks are set up (at top level)
const { create } = await import('../src/gmailExport.js');
const Storage = await import('../src/util/storage.js');
const Dates = await import('../src/util/dates.js');
const Filter = await import('../src/filter.js');
const Filename = await import('../src/filename.js');
const GmailQuery = await import('../src/gmail/query.js');
const Logging = await import('../src/logging.js');
// const MessageWrapper = (await import('../src/gmail/MessageWrapper.js')).default; // Import if needed

// Re-assign mocked functions/classes for easier access if needed
const mockedStorageCreate = Storage.create as jest.Mock;
const mockedDatesCreate = Dates.create as jest.Mock;
const mockedFilterCreate = Filter.create as jest.Mock;
const mockedGetLogger = Logging.getLogger as jest.Mock;
const mockedFormatFilename = Filename.formatFilename as jest.Mock;
const mockedCreateQuery = GmailQuery.createQuery as jest.Mock;

// --- Test Suite --- (NO longer async)
describe('gmailExport', () => {

    // Mock objects (rest of the setup)
    // Simplified mock API
    const mockGetMessage = jest.fn<(params: { userId: string; id: string; format: string; metadataHeaders?: string[] }) => Promise<any>>();
    const mockListMessages = jest.fn<(params: any, cb: (msgs: any[]) => Promise<void>) => Promise<void>>();
    const mockApi = {
        getMessage: mockGetMessage,
        listMessages: mockListMessages,
    } as unknown as GmailApiInstance; // Cast to satisfy type

    // Define a complete mock RunConfig
    const mockRunConfig: RunConfig = {
        outputDirectory: '/export',
        outputStructure: 'year' as OutputStructure,
        filenameOptions: ['date' as FilenameOption],
        credentialsFile: 'credentials.json',
        tokenFile: 'token.json',
        apiScopes: ['scope1'],
        filters: { include: {}, exclude: {} },
        dateRange: { start: new Date('2023-01-01'), end: new Date('2023-01-31') },
        dryRun: false,
        verbose: false,
        timezone: 'UTC',
    };

    const dateRange: DateRange = mockRunConfig.dateRange; // Use range from config

    beforeEach(() => {
        jest.clearAllMocks();

        // Ensure factory mocks return the correct instances
        mockedStorageCreate.mockReturnValue(mockStorageInstance);
        mockedDatesCreate.mockReturnValue(mockDatesInstance);
        mockedFilterCreate.mockReturnValue(mockFilterInstance);
        mockedGetLogger.mockReturnValue(mockLoggerInstance);

        // Reset specific function mocks to defaults if they change per test
        mockedFormatFilename.mockReturnValue('email_2023-01-15.eml');
        mockedCreateQuery.mockReturnValue('after:2023/01/01 before:2023/01/31');
        MockMessageWrapper.mockClear(); // Clear constructor calls
        MockMessageWrapper.mockImplementation(() => mockMessageWrapperInstance); // Re-set implementation

        // Default date mock behavior
        mockDatesInstance.format.mockImplementation((date, format) => {
            if (format === DATE_FORMAT_YEAR) return '2023';
            if (format === DATE_FORMAT_MONTH) return '01';
            if (format === DATE_FORMAT_DAY) return '15';
            return date.toISOString(); // Default format
        });

        // Reset MessageWrapper mock if needed (constructor calls)
        // MockMessageWrapper.mockClear(); // Now cleared in beforeEach
    });

    describe('exportEmails', () => {

        it('should process messages from Gmail API', async () => {
            // Set up mock implementation for listMessages
            mockListMessages.mockImplementation(async (_params, callback) => {
                await callback([{ id: 'msg1' }, { id: 'msg2' }]);
            });

            // Mock MessageWrapper constructor and methods if necessary
            // For simplicity, assume MessageWrapper works or mock its return values
            const mockWrappedMessage = {
                date: '2023-01-15T12:00:00Z',
                subject: 'Test Email',
                // Add other properties accessed by the code
            };
            // MockMessageWrapper is now directly mocked

            // Set up getMessage
            mockGetMessage.mockImplementation(async (params: { id: string; format: string }) => {
                if (params.format === 'metadata') {
                    return { id: params.id, payload: { headers: [{ name: 'Date', value: '2023-01-15T12:00:00Z' } /* other headers */] } };
                } else if (params.format === 'raw') {
                    return { id: params.id, raw: Buffer.from('Raw email content').toString('base64'), labelIds: ['INBOX'], threadId: 'thread1', snippet: 'Email snippet' };
                }
                return null;
            });

            mockFilterInstance.shouldSkipEmail.mockReturnValue({ skip: false });
            mockStorageInstance.exists.mockResolvedValue(false);

            // Call create with only runConfig and api
            const exporter = create(mockRunConfig, mockApi);
            await exporter.exportEmails(dateRange);

            // Verify createQuery call with runConfig
            expect(mockedCreateQuery).toHaveBeenCalledWith(
                dateRange,
                mockRunConfig, // Pass the whole runConfig
                mockRunConfig.timezone
            );

            expect(mockListMessages).toHaveBeenCalledWith(
                { userId: 'me', q: 'after:2023/01/01 before:2023/01/31' },
                expect.any(Function)
            );
            expect(mockGetMessage).toHaveBeenCalledTimes(4);
            expect(mockStorageInstance.writeFile).toHaveBeenCalledTimes(2);
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('Export Summary:');
        });

        it('should skip filtered emails', async () => {
            mockListMessages.mockImplementation(async (_params, callback) => {
                await callback([{ id: 'msg1' }]);
            });
            mockGetMessage.mockResolvedValueOnce({ id: 'msg1', payload: { headers: [/*...*/] } }); // Metadata
            mockFilterInstance.shouldSkipEmail.mockReturnValue({ skip: true, reason: 'Filtered by rule' });

            const exporter = create(mockRunConfig, mockApi);
            await exporter.exportEmails(dateRange);

            expect(mockFilterInstance.shouldSkipEmail).toHaveBeenCalled();
            expect(mockGetMessage).toHaveBeenCalledTimes(1); // Only metadata fetch
            expect(mockStorageInstance.writeFile).not.toHaveBeenCalled();
            expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
                'Filtered email: %s %j',
                'Filtered by rule',
                expect.anything()
            );
        });

        it('should skip existing files', async () => {
            mockListMessages.mockImplementation(async (_params, callback) => {
                await callback([{ id: 'msg1' }]);
            });
            mockGetMessage.mockResolvedValueOnce({ id: 'msg1', payload: { headers: [/*...*/] } }); // Metadata
            mockFilterInstance.shouldSkipEmail.mockReturnValue({ skip: false });
            mockStorageInstance.exists.mockResolvedValue(true);

            const exporter = create(mockRunConfig, mockApi);
            await exporter.exportEmails(dateRange);

            expect(mockStorageInstance.exists).toHaveBeenCalled();
            expect(mockGetMessage).toHaveBeenCalledTimes(1); // Only metadata fetch
            expect(mockStorageInstance.writeFile).not.toHaveBeenCalled();
            expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
                'Skipping existing file: %s',
                expect.any(String)
            );
        });

        it('should handle errors during message processing', async () => {
            mockListMessages.mockImplementation(async (_params, callback) => {
                await callback([{ id: 'msg1' }]);
            });
            mockGetMessage.mockResolvedValueOnce({ id: 'msg1', payload: { headers: [/*...*/] } }); // Metadata OK
            mockGetMessage.mockRejectedValueOnce(new Error('API error')); // Raw fetch fails
            mockFilterInstance.shouldSkipEmail.mockReturnValue({ skip: false });
            mockStorageInstance.exists.mockResolvedValue(false);

            const exporter = create(mockRunConfig, mockApi);
            await exporter.exportEmails(dateRange);

            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                'Error processing message %s: %s',
                'msg1',
                expect.any(Error)
            );
            expect(mockStorageInstance.writeFile).not.toHaveBeenCalled();
        });

        it('should indicate dry run mode', async () => {
            const dryRunConfig = { ...mockRunConfig, dryRun: true };
            mockListMessages.mockImplementation(async (_params, callback) => { await callback([]); });

            const exporter = create(dryRunConfig, mockApi);
            await exporter.exportEmails(dateRange);

            expect(mockLoggerInstance.info).toHaveBeenCalledWith('This was a dry run. No files were actually saved.');
        });

        it('should print summary information after export', async () => {
            mockListMessages.mockImplementation(async (_params, callback) => { await callback([]); });

            const exporter = create(mockRunConfig, mockApi);
            await exporter.exportEmails(dateRange);

            expect(mockLoggerInstance.info).toHaveBeenCalledWith('Export Summary:');
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.stringContaining('Total messages found: 0'));
            // ... other summary checks ...
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.stringContaining('Dry run mode: No'));
        });
    });
});
