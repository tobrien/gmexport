import { jest } from '@jest/globals';
import dayjs from 'dayjs';
import { getLogger } from '../../src/logging.js';
import { Configuration, DateRange } from '../../src/types.js';
import { createQuery, formatDateForGmailQuery, printGmailQueryInfo } from '../../src/gmail/query.js';

jest.mock('../../src/logging.js');

describe('Gmail Query', () => {
    const mockLogger = {
        info: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getLogger as jest.Mock).mockReturnValue(mockLogger);
    });

    describe('formatDateForGmailQuery', () => {
        it('should format date in YYYY/MM/DD format', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            expect(formatDateForGmailQuery(date)).toBe('2024/01/15');
        });
    });

    describe('createQuery', () => {
        const dateRange: DateRange = {
            start: dayjs('2024-01-01').toDate(),
            end: dayjs('2024-01-31').toDate()
        };

        it('should create basic query with date range only', () => {
            const config: Configuration = {
                filters: {
                    include: {},
                    exclude: {}
                }
            } as Configuration;

            const query = createQuery(dateRange, config);
            expect(query).toBe('after:2024/01/01 before:2024/02/01');
        });

        it('should include label filters when specified', () => {
            const config: Configuration = {
                filters: {
                    include: {
                        labels: ['INBOX', 'IMPORTANT']
                    },
                    exclude: {}
                }
            } as Configuration;

            const query = createQuery(dateRange, config);
            expect(query).toBe('after:2024/01/01 before:2024/02/01 label:INBOX OR label:IMPORTANT');
        });

        it('should exclude label filters when specified', () => {
            const config: Configuration = {
                filters: {
                    include: {},
                    exclude: {
                        labels: ['SPAM', 'TRASH']
                    }
                }
            } as Configuration;

            const query = createQuery(dateRange, config);
            expect(query).toBe('after:2024/01/01 before:2024/02/01 -label:SPAM AND -label:TRASH');
        });

        it('should combine include and exclude label filters', () => {
            const config: Configuration = {
                filters: {
                    include: {
                        labels: ['INBOX']
                    },
                    exclude: {
                        labels: ['SPAM']
                    }
                }
            } as Configuration;

            const query = createQuery(dateRange, config);
            expect(query).toBe('after:2024/01/01 before:2024/02/01 label:INBOX -label:SPAM');
        });
    });

    describe('printGmailQueryInfo', () => {
        it('should log query information correctly', () => {
            const afterDate = '2024/01/01';
            const beforeDate = '2024/02/01';
            const includeLabels = ['INBOX', 'IMPORTANT'];
            const excludeLabels = ['SPAM'];
            const query = 'test query';

            printGmailQueryInfo(afterDate, beforeDate, includeLabels, excludeLabels, query);

            expect(mockLogger.info).toHaveBeenCalledWith('Gmail search parameters:');
            expect(mockLogger.info).toHaveBeenCalledWith('\tDate range: 2024/01/01 to 2024/02/01');
            expect(mockLogger.info).toHaveBeenCalledWith('\tInclude labels: INBOX, IMPORTANT');
            expect(mockLogger.info).toHaveBeenCalledWith('\tExclude labels: SPAM');
            expect(mockLogger.info).toHaveBeenCalledWith('\tFull query: test query');
        });

        it('should handle empty label arrays', () => {
            printGmailQueryInfo('2024/01/01', '2024/02/01', [], [], 'query');

            expect(mockLogger.info).toHaveBeenCalledWith('\tInclude labels: none');
            expect(mockLogger.info).toHaveBeenCalledWith('\tExclude labels: none');
        });
    });
});
