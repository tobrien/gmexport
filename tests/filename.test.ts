import { describe, it, expect } from '@jest/globals';
import { formatFilename } from '../src/filename.js';
import { Configuration, FilenameOption } from '../src/types.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

describe('filename.ts', () => {
    const baseConfig: Configuration = {
        credentials: {
            credentials_file: 'test.json',
            token_file: 'test-token.json'
        },
        export: {
            max_results: 100,
            destination_dir: './exports',
            dry_run: false,
            output_structure: 'month',
            timezone: 'UTC'
        },
        api: {
            scopes: ['https://www.googleapis.com/auth/gmail.readonly']
        },
        filters: {
            exclude: {},
            include: {}
        }
    };

    const testDate = dayjs.tz('2024-03-15T20:30:00', 'America/New_York').toDate();
    const testMessageId = 'abc123';
    const testSubject = 'Test Email Subject';

    it('should format filename with no options', () => {
        const config = { ...baseConfig };
        const result = formatFilename(testMessageId, testDate, testSubject, config);
        expect(result).toBe('abc123.eml');
    });

    it('should format filename with date option (month structure)', () => {
        const testDate = dayjs.tz('2024-03-20T14:30:00', 'America/New_York').tz('UTC');
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                filename_options: ['date' as FilenameOption]
            }
        };
        const result = formatFilename(testMessageId, testDate.toDate(), testSubject, config);
        expect(result).toBe(`${testDate.format('DD')}-abc123.eml`);
    });

    it('should format filename with date option (year structure)', () => {
        const testDate = dayjs.tz('2024-03-20T14:30:00', 'America/New_York').tz('UTC');
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                output_structure: 'year' as const,
                filename_options: ['date' as FilenameOption]
            }
        };
        const result = formatFilename(testMessageId, testDate.toDate(), testSubject, config);
        expect(result).toBe(`${testDate.format('MM-DD')}-abc123.eml`);
    });

    it('should format filename with time option', () => {
        const testDate = dayjs.tz('2024-03-20T14:30:00', 'America/New_York').tz('UTC');
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                filename_options: ['time' as FilenameOption]
            }
        };
        const result = formatFilename(testMessageId, testDate.toDate(), testSubject, config);
        expect(result).toBe(`${testDate.format('HHmm')}-abc123.eml`);
    });

    it('should format filename with subject option', () => {
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                filename_options: ['subject' as FilenameOption]
            }
        };
        const result = formatFilename(testMessageId, testDate, testSubject, config);
        expect(result).toBe('abc123-test-email-subject.eml');
    });

    it('should format filename with all options', () => {
        const testDate = dayjs.tz('2024-03-15T120:30:00', 'America/New_York').tz('UTC');
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                filename_options: ['date', 'time', 'subject'] as FilenameOption[]
            }
        };
        const result = formatFilename(testMessageId, testDate.toDate(), testSubject, config);
        expect(result).toBe(`${testDate.format('DD')}-${testDate.format('HHmm')}-abc123-test-email-subject.eml`);
    });

    it('should handle special characters in subject', () => {
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                filename_options: ['subject' as FilenameOption]
            }
        };
        const result = formatFilename(testMessageId, testDate, 'Test@#$%^&*() Subject!', config);
        expect(result).toBe('abc123-test-subject.eml');
    });

    it('should throw error when using date option with day structure', () => {
        const config: Configuration = {
            ...baseConfig,
            export: {
                ...baseConfig.export,
                output_structure: 'day' as const,
                filename_options: ['date' as FilenameOption]
            }
        };
        expect(() => formatFilename(testMessageId, testDate, testSubject, config)).toThrow();
    });
}); 