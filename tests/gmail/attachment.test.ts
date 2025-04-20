import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { Buffer } from 'buffer';
import * as path from 'path';
import { gmail_v1 } from 'googleapis';
import {
    DEFAULT_BINARY_TO_TEXT_ENCODING,
    DATE_FORMAT_DAY,
    DATE_FORMAT_HOURS,
    DATE_FORMAT_MINUTES,
    DATE_FORMAT_MONTH,
    DATE_FORMAT_YEAR,
    DEFAULT_CHARACTER_ENCODING,
} from '../../src/constants';
import { Instance as GmailApiInstance } from '../../src/gmail/api.d';

// Mock storage utilities
const mockStorage = {
    createDirectory: jest.fn(),
    // @ts-ignore
    writeFile: jest.fn().mockResolvedValue(undefined as any),
};

const mockStorageCreate = jest.fn().mockReturnValue(mockStorage);

// Mock date utilities
const mockDates = {
    format: jest.fn((date, format) => {
        switch (format) {
            case DATE_FORMAT_YEAR: return '2023';
            case DATE_FORMAT_MONTH: return '01';
            case DATE_FORMAT_DAY: return '15';
            case DATE_FORMAT_HOURS: return '14';
            case DATE_FORMAT_MINUTES: return '30';
            default: return '';
        }
    }),
};

const mockDatesCreate = jest.fn().mockReturnValue(mockDates);

// Mock Gmail API with properly typed mock function
const mockGetAttachment = jest.fn().mockImplementation(() =>
    Promise.resolve({} as gmail_v1.Schema$MessagePartBody));
const mockGmailApi: GmailApiInstance = {
    getAttachment: mockGetAttachment,
} as unknown as GmailApiInstance;

// Mock modules
jest.unstable_mockModule('../../src/util/storage', () => ({
    __esModule: true,
    create: mockStorageCreate,
}));

jest.unstable_mockModule('../../src/util/dates', () => ({
    __esModule: true,
    create: mockDatesCreate,
}));

// Variables for dynamically imported modules
let sanitizeFilename: any;
let getAttachmentFilePath: any;
let saveAttachment: any;

// Load all dependencies before tests
beforeAll(async () => {
    const attachmentModule = await import('../../src/gmail/attachment');
    sanitizeFilename = attachmentModule.sanitizeFilename;
    getAttachmentFilePath = attachmentModule.getAttachmentFilePath;
    saveAttachment = attachmentModule.saveAttachment;
});

describe('Gmail Attachment Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sanitizeFilename', () => {
        test('should replace invalid characters with dashes', () => {
            const invalidFilenames = [
                'file:with:colons',
                'file/with/slashes',
                'file\\with\\backslashes',
                'file"with"quotes',
                'file<with>brackets',
                'file|with|pipes',
                'file?with?questions',
                'file*with*stars'
            ];

            const validFilenames = [
                'file-with-colons',
                'file-with-slashes',
                'file-with-backslashes',
                'file-with-quotes',
                'file-with-brackets',
                'file-with-pipes',
                'file-with-questions',
                'file-with-stars'
            ];

            invalidFilenames.forEach((filename, index) => {
                expect(sanitizeFilename(filename)).toBe(validFilenames[index]);
            });
        });

        test('should not modify valid filenames', () => {
            const validFilenames = [
                'normal-file.txt',
                'file with spaces.pdf',
                'file_with_underscores.jpg',
                'file-with-dashes.png',
                'file.with.dots.exe'
            ];

            validFilenames.forEach(filename => {
                expect(sanitizeFilename(filename)).toBe(filename);
            });
        });
    });

    describe('getAttachmentFilePath', () => {
        const baseDir = '/test/output';
        const date = new Date('2023-01-15T14:30:00Z');
        const subject = 'Test Subject';
        const timezone = 'UTC';

        test('should create path with correct structure and sanitized names', () => {
            const attachmentName = 'test-attachment.pdf';
            const result = getAttachmentFilePath(baseDir, date, subject, attachmentName, timezone);

            expect(mockDatesCreate).toHaveBeenCalledWith({ timezone });
            expect(mockDates.format).toHaveBeenCalledWith(date, DATE_FORMAT_YEAR);
            expect(mockDates.format).toHaveBeenCalledWith(date, DATE_FORMAT_MONTH);
            expect(mockDates.format).toHaveBeenCalledWith(date, DATE_FORMAT_DAY);
            expect(mockDates.format).toHaveBeenCalledWith(date, DATE_FORMAT_HOURS);
            expect(mockDates.format).toHaveBeenCalledWith(date, DATE_FORMAT_MINUTES);

            const expectedPath = path.join(baseDir, '2023', '01', 'attachments', '15-1430-Test Subject-test-attachment.pdf');
            expect(result).toBe(expectedPath);
            expect(mockStorage.createDirectory).toHaveBeenCalledWith(path.join(baseDir, '2023', '01', 'attachments'));
        });

        test('should sanitize subject and attachment name', () => {
            const attachmentName = 'test/attachment:with?invalid*chars.pdf';
            const subjectWithInvalidChars = 'Test: Subject/with*invalid?chars';

            const result = getAttachmentFilePath(baseDir, date, subjectWithInvalidChars, attachmentName, timezone);

            const expectedPath = path.join(baseDir, '2023', '01', 'attachments', '15-1430-Test- Subject-with-invalid-chars-attachment-with-invalid-chars.pdf');
            expect(result).toBe(expectedPath);
        });
    });

    describe('saveAttachment', () => {
        const userId = 'user123';
        const messageId = 'msg123';
        const attachmentId = 'att123';
        const filename = 'test-attachment.pdf';
        const destinationDir = '/test/output';
        const date = new Date('2023-01-15T14:30:00Z');
        const subject = 'Test Subject';
        const timezone = 'UTC';
        const testData = 'test-attachment-data';
        const encodedData = Buffer.from(testData).toString('base64');

        beforeEach(() => {
            // Reset mocks with proper implementation
            // @ts-ignore
            mockGetAttachment.mockResolvedValue({
                data: encodedData,
                size: testData.length
            } as gmail_v1.Schema$MessagePartBody);
        });

        test('should save attachment successfully when not in dry run mode', async () => {
            const dryRun = false;
            const expectedPath = path.join(destinationDir, '2023', '01', 'attachments', '15-1430-Test Subject-test-attachment.pdf');

            const result = await saveAttachment(
                mockGmailApi,
                userId,
                messageId,
                attachmentId,
                filename,
                destinationDir,
                date,
                subject,
                dryRun,
                timezone
            );

            expect(mockGmailApi.getAttachment).toHaveBeenCalledWith({
                userId,
                messageId,
                id: attachmentId
            });
            // @ts-ignore
            expect(mockStorage.writeFile).toHaveBeenCalledWith(
                expectedPath,
                expect.any(Buffer),
                DEFAULT_CHARACTER_ENCODING
            );
            expect(result).toBe(expectedPath);
        });

        test('should not save attachment in dry run mode', async () => {
            const dryRun = true;

            await saveAttachment(
                mockGmailApi,
                userId,
                messageId,
                attachmentId,
                filename,
                destinationDir,
                date,
                subject,
                dryRun,
                timezone
            );

            expect(mockGmailApi.getAttachment).toHaveBeenCalled();
            expect(mockStorage.writeFile).not.toHaveBeenCalled();
        });

        test('should throw error when attachment is null', async () => {
            // @ts-ignore
            mockGetAttachment.mockResolvedValue(null);

            await expect(saveAttachment(
                mockGmailApi,
                userId,
                messageId,
                attachmentId,
                filename,
                destinationDir,
                date,
                subject,
                false,
                timezone
            )).rejects.toThrow('Attachment is null');
        });

        test('should throw error when attachment data is null', async () => {
            // @ts-ignore
            mockGetAttachment.mockResolvedValue({
                data: null
            } as gmail_v1.Schema$MessagePartBody);

            await expect(saveAttachment(
                mockGmailApi,
                userId,
                messageId,
                attachmentId,
                filename,
                destinationDir,
                date,
                subject,
                false,
                timezone
            )).rejects.toThrow('Attachment data is null');
        });
    });
});
