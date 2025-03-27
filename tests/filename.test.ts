import { formatFilename } from '../src/filename.js';
import { FilenameOption, OutputStructure } from '../src/export.d.js';
import { jest } from '@jest/globals';

describe('filename', () => {

    beforeEach(() => {
        // Clear mocks
        jest.clearAllMocks();
    });

    describe('formatFilename', () => {
        const messageId = 'abc123';
        const date = new Date('2024-01-02T12:34:56Z');
        const subject = 'Test Subject!';
        const timezone = 'UTC';

        it('should format filename with date option for no structure', () => {
            const options: FilenameOption[] = ['date'];
            const structure: OutputStructure = 'none';

            const result = formatFilename(messageId, date, subject, timezone, options, structure);

            expect(result).toBe('2024-01-02-abc123.eml');
        });

        it('should format filename with date option for year structure', () => {
            const options: FilenameOption[] = ['date'];
            const structure: OutputStructure = 'year';

            const result = formatFilename(messageId, date, subject, timezone, options, structure);

            expect(result).toBe('01-02-abc123.eml');
        });

        it('should format filename with date option for month structure', () => {
            const options: FilenameOption[] = ['date'];
            const structure: OutputStructure = 'month';

            const result = formatFilename(messageId, date, subject, timezone, options, structure);

            expect(result).toBe('02-abc123.eml');
        });

        it('should throw error when using date with day structure', () => {
            const options: FilenameOption[] = ['date'];
            const structure: OutputStructure = 'day';

            expect(() => {
                formatFilename(messageId, date, subject, timezone, options, structure);
            }).toThrow('Cannot use date in filename when output structure is "day"');
        });

        it('should format filename with time option', () => {
            const options: FilenameOption[] = ['time'];
            const structure: OutputStructure = 'year';

            const result = formatFilename(messageId, date, subject, timezone, options, structure);

            expect(result).toBe('1234-abc123.eml');
        });

        it('should format filename with subject option', () => {
            const options: FilenameOption[] = ['subject'];
            const structure: OutputStructure = 'year';

            const result = formatFilename(messageId, date, subject, timezone, options, structure);

            expect(result).toBe('abc123-test-subject.eml');
        });

        it('should format filename with all options', () => {
            const options: FilenameOption[] = ['date', 'time', 'subject'];
            const structure: OutputStructure = 'year';

            const result = formatFilename(messageId, date, subject, timezone, options, structure);

            expect(result).toBe('01-02-1234-abc123-test-subject.eml');
        });

        it('should handle special characters in subject', () => {
            const options: FilenameOption[] = ['subject'];
            const structure: OutputStructure = 'year';
            const specialSubject = 'Test! @#$% Subject &*()';

            const result = formatFilename(messageId, date, specialSubject, timezone, options, structure);

            expect(result).toBe('abc123-test-subject-.eml');
        });

        it('should truncate long subjects to 50 characters', () => {
            const options: FilenameOption[] = ['subject'];
            const structure: OutputStructure = 'year';
            const longSubject = 'This is a very long subject that should be truncated to fifty characters';

            const result = formatFilename(messageId, date, longSubject, timezone, options, structure);

            expect(result.length).toBeLessThanOrEqual(50 + 'abc123-.eml'.length);
        });
    });
});
