import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { Config as RunConfig, DateRange } from '../../src/run';
import { DATE_FORMAT_YEAR_MONTH_DAY_SLASH } from '../../src/constants';
import { OutputStructure, FilenameOption } from '@tobrien/cabazooka';

// Define mock instances types (can be more specific if needed)
type MockLogger = { info: jest.Mock<() => void> };
type MockDatesInstance = {
    format: jest.Mock<(date: Date | string, format: string) => string>;
    addDays: jest.Mock<(date: Date, days: number) => Date | string>;
};

// Mock dependencies using unstable_mockModule
const mockLogger: MockLogger = {
    info: jest.fn(),
};
const mockDatesInstance: MockDatesInstance = {
    format: jest.fn(),
    addDays: jest.fn(),
};

jest.unstable_mockModule('../../src/logging', () => ({
    getLogger: jest.fn(() => mockLogger),
}));
jest.unstable_mockModule('../../src/util/dates', () => ({
    create: jest.fn(() => mockDatesInstance),
}));


// --- Dynamic Imports (after mocks) ---
const { createQuery, printGmailQueryInfo } = await import('../../src/gmail/query');
const Logging = await import('../../src/logging');
const Dates = await import('../../src/util/dates');

// Use describe block without async
describe('Gmail Query Module', () => {
    // Dynamically import modules after mocks are set up -> Moved outside
    // const { createQuery, printGmailQueryInfo } = await import('../../src/gmail/query');
    // const Logging = await import('../../src/logging');
    // const Dates = await import('../../src/util/dates');

    // Re-assign mocked functions for easier access in tests if needed
    // Note: Direct access via mockLogger and mockDatesInstance is often clearer
    const mockedGetLogger = Logging.getLogger as jest.Mock;
    const mockedCreateDates = Dates.create as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks if necessary, though direct mock function calls are reset by clearAllMocks
        mockedGetLogger.mockReturnValue(mockLogger); // Ensure getLogger returns the mock instance
        mockedCreateDates.mockReturnValue(mockDatesInstance); // Ensure create returns the mock instance
    });

    describe('createQuery', () => {
        const timezone = 'America/New_York';
        const dateRange: DateRange = {
            start: new Date('2023-01-01'),
            end: new Date('2023-01-31'),
        };

        const baseConfig: RunConfig = {
            outputDirectory: '/output',
            outputStructure: 'year' as OutputStructure,
            outputFilenameOptions: ['date' as FilenameOption, 'subject' as FilenameOption],
            credentialsFile: 'credentials.json',
            tokenFile: 'token.json',
            apiScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
            dateRange: dateRange,
            dryRun: false,
            verbose: false,
            timezone: timezone,
            filters: {}
        };

        beforeEach(() => {
            mockDatesInstance.format.mockImplementation((date, format) => {
                if (date === dateRange.start && format === DATE_FORMAT_YEAR_MONTH_DAY_SLASH) return '2023/01/01';
                if (date === 'adjusted_end_date' && format === DATE_FORMAT_YEAR_MONTH_DAY_SLASH) return '2023/02/01';
                return '';
            });
            mockDatesInstance.addDays.mockReturnValue('adjusted_end_date' as any);
        });

        test('should create basic date range query', () => {
            const config: RunConfig = { ...baseConfig, filters: {} };

            const result = createQuery(dateRange, config, timezone);

            expect(mockedCreateDates).toHaveBeenCalledWith({ timezone });
            expect(mockDatesInstance.format).toHaveBeenCalledWith(dateRange.start, DATE_FORMAT_YEAR_MONTH_DAY_SLASH);
            expect(mockDatesInstance.addDays).toHaveBeenCalledWith(dateRange.end, 1);
            expect(mockDatesInstance.format).toHaveBeenCalledWith('adjusted_end_date', DATE_FORMAT_YEAR_MONTH_DAY_SLASH);
            expect(result).toBe('after:2023/01/01 before:2023/02/01');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Gmail search parameters:'));
        });

        test('should add include labels to query', () => {
            const config: RunConfig = {
                ...baseConfig,
                filters: {
                    include: {
                        labels: ['important', 'work']
                    }
                }
            };
            const result = createQuery(dateRange, config, timezone);
            expect(result).toBe('after:2023/01/01 before:2023/02/01 label:important OR label:work');
        });

        test('should add exclude labels to query', () => {
            const config: RunConfig = {
                ...baseConfig,
                filters: {
                    exclude: {
                        labels: ['spam', 'trash']
                    }
                }
            };
            const result = createQuery(dateRange, config, timezone);
            expect(result).toBe('after:2023/01/01 before:2023/02/01 -label:spam AND -label:trash');
        });

        test('should handle both include and exclude labels', () => {
            const config: RunConfig = {
                ...baseConfig,
                filters: {
                    include: {
                        labels: ['important']
                    },
                    exclude: {
                        labels: ['spam']
                    }
                }
            };
            const result = createQuery(dateRange, config, timezone);
            expect(result).toBe('after:2023/01/01 before:2023/02/01 label:important -label:spam');
        });

        test('should handle empty filter arrays', () => {
            const config: RunConfig = {
                ...baseConfig,
                filters: {
                    include: {
                        labels: []
                    },
                    exclude: {
                        labels: []
                    }
                }
            };
            const result = createQuery(dateRange, config, timezone);
            expect(result).toBe('after:2023/01/01 before:2023/02/01');
        });
    });

    describe('printGmailQueryInfo', () => {
        test('should log Gmail query information', () => {
            const afterDate = '2023/01/01';
            const beforeDate = '2023/02/01';
            const includeLabels = ['important', 'work'];
            const excludeLabels = ['spam'];
            const query = 'after:2023/01/01 before:2023/02/01 label:important OR label:work -label:spam';

            printGmailQueryInfo(afterDate, beforeDate, includeLabels, excludeLabels, query);

            expect(mockedGetLogger).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Gmail search parameters:');
            expect(mockLogger.info).toHaveBeenCalledWith(`\tDate range: ${afterDate} to ${beforeDate}`);
            expect(mockLogger.info).toHaveBeenCalledWith(`\tInclude labels: ${includeLabels.join(', ')}`);
            expect(mockLogger.info).toHaveBeenCalledWith(`\tExclude labels: ${excludeLabels.join(', ')}`);
            expect(mockLogger.info).toHaveBeenCalledWith(`\tFull query: ${query}`);
        });

        test('should handle empty labels arrays', () => {
            const afterDate = '2023/01/01';
            const beforeDate = '2023/02/01';
            const includeLabels: string[] = [];
            const excludeLabels: string[] = [];
            const query = 'after:2023/01/01 before:2023/02/01';

            printGmailQueryInfo(afterDate, beforeDate, includeLabels, excludeLabels, query);

            expect(mockLogger.info).toHaveBeenCalledWith(`\tInclude labels: none`);
            expect(mockLogger.info).toHaveBeenCalledWith(`\tExclude labels: none`);
        });
    });
});
