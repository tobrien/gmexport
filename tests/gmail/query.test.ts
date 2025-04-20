import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { Config } from '../../src/export.d';
import { DATE_FORMAT_YEAR_MONTH_DAY_SLASH } from '../../src/constants';

// Mock logger
const mockLogger = {
    info: jest.fn(),
};

// Mock date utilities
const mockDates = {
    format: jest.fn(),
    addDays: jest.fn(),
};

const mockCreate = jest.fn().mockReturnValue(mockDates);

// Mock modules using jest.unstable_mockModule
jest.unstable_mockModule('../../src/logging', () => ({
    __esModule: true,
    getLogger: jest.fn().mockReturnValue(mockLogger)
}));

jest.unstable_mockModule('../../src/util/dates', () => ({
    __esModule: true,
    create: mockCreate
}));

// Variables for dynamically imported modules
let createQuery: any;
let printGmailQueryInfo: any;
let getLogger: any;

// Load all dependencies before tests
beforeAll(async () => {
    const queryModule = await import('../../src/gmail/query');
    createQuery = queryModule.createQuery;
    printGmailQueryInfo = queryModule.printGmailQueryInfo;

    const loggingModule = await import('../../src/logging');
    getLogger = loggingModule.getLogger;
});

describe('Gmail Query Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createQuery', () => {
        const timezone = 'America/New_York';
        const dateRange = {
            start: new Date('2023-01-01'),
            end: new Date('2023-01-31'),
        };

        // Base config with required fields
        const baseConfig: Config = {
            outputDirectory: '/output',
            outputStructure: 'year',
            filenameOptions: ['date', 'subject'],
            credentialsFile: 'credentials.json',
            tokenFile: 'token.json',
            apiScopes: ['https://www.googleapis.com/auth/gmail.readonly']
        };

        beforeEach(() => {
            mockDates.format.mockImplementation((date, format) => {
                if (date === dateRange.start) return '2023/01/01';
                if (date === 'adjusted_end_date') return '2023/02/01';
                return '';
            });

            mockDates.addDays.mockReturnValue('adjusted_end_date');
        });

        test('should create basic date range query', () => {
            const config: Config = { ...baseConfig, filters: {} };

            const result = createQuery(dateRange, config, timezone);

            expect(mockCreate).toHaveBeenCalledWith({ timezone });
            expect(mockDates.format).toHaveBeenCalledWith(dateRange.start, DATE_FORMAT_YEAR_MONTH_DAY_SLASH);
            expect(mockDates.addDays).toHaveBeenCalledWith(dateRange.end, 1);
            expect(mockDates.format).toHaveBeenCalledWith('adjusted_end_date', DATE_FORMAT_YEAR_MONTH_DAY_SLASH);
            expect(result).toBe('after:2023/01/01 before:2023/02/01');
        });

        test('should add include labels to query', () => {
            const config: Config = {
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
            const config: Config = {
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
            const config: Config = {
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
            const config: Config = {
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

            expect(getLogger).toHaveBeenCalled();
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
