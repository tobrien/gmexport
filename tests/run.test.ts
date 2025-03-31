import { jest } from '@jest/globals';

// Mock the dates module
const mockCreate = jest.fn();
jest.unstable_mockModule('../src/util/dates.js', () => ({
    __esModule: true,
    create: mockCreate
}));

// Import modules asynchronously
let Run: any;
let ConfigError: any;
let createConfig: any;

// Define mock date utility
const mockDateUtility = {
    now: jest.fn(),
    date: jest.fn(date => date),
    startOfMonth: jest.fn(),
    subDays: jest.fn(),
    isBefore: jest.fn()
};

// Load all dynamic imports before tests
beforeAll(async () => {
    Run = await import('../src/run.js');
    ConfigError = Run.ConfigError;
    createConfig = Run.createConfig;
});

describe('run', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreate.mockReturnValue(mockDateUtility);
    });

    describe('ConfigError', () => {
        it('should create error with correct name and message', () => {
            const error = new ConfigError('Test error');
            expect(error.name).toBe('Run.ConfigError');
            expect(error.message).toBe('Test error');
        });
    });

    describe('createConfig', () => {
        it('should create config with current month range', () => {
            const now = new Date('2023-07-15T12:00:00Z');
            const startOfMonth = new Date('2023-07-01T00:00:00Z');

            mockDateUtility.now.mockReturnValue(now);
            mockDateUtility.startOfMonth.mockReturnValue(startOfMonth);
            mockDateUtility.isBefore.mockReturnValue(false);

            const result = createConfig({
                timezone: 'America/New_York',
                currentMonth: true,
                dryRun: true,
                verbose: false
            });

            expect(mockCreate).toHaveBeenCalledWith({ timezone: 'America/New_York' });
            expect(result).toEqual({
                dateRange: {
                    start: startOfMonth,
                    end: now
                },
                dryRun: true,
                verbose: false,
                timezone: 'America/New_York'
            });
        });

        it('should create config with custom date range', () => {
            const start = new Date('2023-06-01T00:00:00Z');
            const end = new Date('2023-06-30T23:59:59Z');

            mockDateUtility.date.mockImplementation(date => date);
            mockDateUtility.isBefore.mockReturnValue(false);

            const result = createConfig({
                timezone: 'Europe/London',
                start,
                end,
                currentMonth: false,
                dryRun: false,
                verbose: true
            });

            expect(mockCreate).toHaveBeenCalledWith({ timezone: 'Europe/London' });
            expect(result).toEqual({
                dateRange: {
                    start,
                    end
                },
                dryRun: false,
                verbose: true,
                timezone: 'Europe/London'
            });
        });

        it('should create config with default end date when not provided', () => {
            const start = new Date('2023-06-01T00:00:00Z');
            const now = new Date('2023-06-15T12:00:00Z');

            mockDateUtility.now.mockReturnValue(now);
            mockDateUtility.date.mockImplementation(date => date || now);
            mockDateUtility.isBefore.mockReturnValue(false);

            const result = createConfig({
                timezone: 'UTC',
                start,
                currentMonth: false,
                dryRun: true,
                verbose: true
            });

            expect(result.dateRange.start).toBe(start);
            expect(result.dateRange.end).toBe(now);
        });

        it('should create config with default start date when not provided', () => {
            const end = new Date('2023-06-30T23:59:59Z');
            const calculatedStart = new Date('2023-05-30T23:59:59Z');

            mockDateUtility.date.mockImplementation(date => date);
            mockDateUtility.subDays.mockReturnValue(calculatedStart);
            mockDateUtility.isBefore.mockReturnValue(false);

            const result = createConfig({
                timezone: 'Asia/Tokyo',
                end,
                currentMonth: false,
                dryRun: false,
                verbose: false
            });

            expect(mockDateUtility.subDays).toHaveBeenCalledWith(end, 31);
            expect(result.dateRange.start).toBe(calculatedStart);
            expect(result.dateRange.end).toBe(end);
        });

        it('should throw ConfigError when end date is before start date', () => {
            const start = new Date('2023-07-15T00:00:00Z');
            const end = new Date('2023-07-10T00:00:00Z');

            mockDateUtility.date.mockImplementation(date => date);
            mockDateUtility.isBefore.mockReturnValue(true);

            expect(() => createConfig({
                timezone: 'UTC',
                start,
                end,
                currentMonth: false,
                dryRun: true,
                verbose: false
            })).toThrow(ConfigError);
            expect(() => createConfig({
                timezone: 'UTC',
                start,
                end,
                currentMonth: false,
                dryRun: true,
                verbose: false
            })).toThrow(/End date must be after start date/);
        });

        it('should correctly format and parse dates with timezone', () => {
            const start = new Date('2023-08-01T00:00:00Z');
            const end = new Date('2023-08-15T23:59:59Z');

            // Mock the date behavior
            mockDateUtility.date.mockImplementation((date) => {
                if (date === start) return new Date('2023-08-01T03:00:00+03:00');
                if (date === end) return new Date('2023-08-16T02:59:59+03:00');
                return date;
            });
            mockDateUtility.isBefore.mockReturnValue(false);

            const result = createConfig({
                timezone: 'Europe/Athens', // UTC+3 in August
                start,
                end,
                currentMonth: false,
                dryRun: true,
                verbose: false
            });

            expect(mockCreate).toHaveBeenCalledWith({ timezone: 'Europe/Athens' });
            expect(mockDateUtility.date).toHaveBeenCalledWith(start);
            expect(mockDateUtility.date).toHaveBeenCalledWith(end);

            // The formatted dates should reflect the timezone
            expect(result.dateRange.start).toEqual(new Date('2023-08-01T03:00:00+03:00'));
            expect(result.dateRange.end).toEqual(new Date('2023-08-16T02:59:59+03:00'));
        });
    });
});
