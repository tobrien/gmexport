import { FilenameOption, OutputStructure } from '../src/export.d.js';
import {
    VERSION,
    PROGRAM_NAME,
    DEFAULT_CHARACTER_ENCODING,
    DEFAULT_BINARY_TO_TEXT_ENCODING,
    DEFAULT_DESTINATION_DIR,
    DATE_FORMAT_MONTH_DAY,
    DATE_FORMAT_YEAR,
    DATE_FORMAT_YEAR_MONTH,
    DATE_FORMAT_YEAR_MONTH_DAY,
    DATE_FORMAT_YEAR_MONTH_DAY_SLASH,
    DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES,
    DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS,
    DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS_MILLISECONDS,
    DATE_FORMAT_MONTH,
    DATE_FORMAT_DAY,
    DATE_FORMAT_HOURS,
    DATE_FORMAT_MINUTES,
    DATE_FORMAT_SECONDS,
    DATE_FORMAT_MILLISECONDS,
    DEFAULT_TIMEZONE,
    DEFAULT_CREDENTIALS_FILE,
    DEFAULT_TOKEN_FILE,
    DEFAULT_SCOPES,
    DEFAULT_OUTPUT_STRUCTURE,
    DEFAULT_FILENAME_OPTIONS,
    DEFAULT_VERBOSE,
    DEFAULT_DRY_RUN,
    DEFAULT_CURRENT_MONTH,
    ALLOWED_SCOPES
} from '../src/constants.js';

describe('constants', () => {
    it('should have correct string values', () => {
        expect(PROGRAM_NAME).toBe('gmexport');
        expect(DEFAULT_CHARACTER_ENCODING).toBe('utf-8');
        expect(DEFAULT_BINARY_TO_TEXT_ENCODING).toBe('base64');
        expect(DEFAULT_DESTINATION_DIR).toBe('./exports');
        expect(DEFAULT_CREDENTIALS_FILE).toBe('./credentials.json');
        expect(DEFAULT_TOKEN_FILE).toBe('./token.json');
        expect(DEFAULT_TIMEZONE).toBe('Etc/UTC');
    });

    it('should have correct date format strings', () => {
        expect(DATE_FORMAT_MONTH_DAY).toBe('MM-DD');
        expect(DATE_FORMAT_YEAR).toBe('YYYY');
        expect(DATE_FORMAT_YEAR_MONTH).toBe('YYYY-MM');
        expect(DATE_FORMAT_YEAR_MONTH_DAY).toBe('YYYY-MM-DD');
        expect(DATE_FORMAT_YEAR_MONTH_DAY_SLASH).toBe('YYYY/MM/DD');
        expect(DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES).toBe('YYYY-MM-DD-HHmm');
        expect(DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS).toBe('YYYY-MM-DD-HHmmss');
        expect(DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS_MILLISECONDS).toBe('YYYY-MM-DD-HHmmss.SSS');
        expect(DATE_FORMAT_MONTH).toBe('M');
        expect(DATE_FORMAT_DAY).toBe('DD');
        expect(DATE_FORMAT_HOURS).toBe('HHmm');
        expect(DATE_FORMAT_MINUTES).toBe('mm');
        expect(DATE_FORMAT_SECONDS).toBe('ss');
        expect(DATE_FORMAT_MILLISECONDS).toBe('SSS');
    });

    it('should have correct default scopes', () => {
        expect(DEFAULT_SCOPES).toEqual(['https://www.googleapis.com/auth/gmail.readonly']);
    });

    it('should have correct allowed scopes', () => {
        expect(ALLOWED_SCOPES).toContain('https://www.googleapis.com/auth/gmail.readonly');
        expect(ALLOWED_SCOPES).toContain('https://www.googleapis.com/auth/gmail.modify');
        expect(ALLOWED_SCOPES).toContain('https://mail.google.com/');
        expect(ALLOWED_SCOPES.length).toBe(14);
    });

    it('should have correct default output structure', () => {
        expect(DEFAULT_OUTPUT_STRUCTURE).toBe('month');
        const isValidOutputStructure: OutputStructure = DEFAULT_OUTPUT_STRUCTURE;
        expect(['year', 'month', 'day']).toContain(isValidOutputStructure);
    });

    it('should have correct default filename options', () => {
        expect(DEFAULT_FILENAME_OPTIONS).toEqual(['date', 'subject']);
        const isValidFilenameOption: FilenameOption[] = DEFAULT_FILENAME_OPTIONS;
        expect(isValidFilenameOption.every(opt => ['date', 'time', 'subject'].includes(opt))).toBe(true);
    });

    it('should have correct boolean defaults', () => {
        expect(DEFAULT_VERBOSE).toBe(false);
        expect(DEFAULT_DRY_RUN).toBe(false);
        expect(DEFAULT_CURRENT_MONTH).toBe(false);
    });
});
