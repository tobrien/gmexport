import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeFilename, ensureDirectoryExists, getAttachmentFilePath, saveAttachment } from '../../src/gmail/attachment';
import { getLogger } from '../../src/logging';

jest.mock('fs');
jest.mock('../../src/logging');

describe('Attachment functions', () => {
    const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getLogger as jest.Mock).mockReturnValue(mockLogger);
    });

    describe('sanitizeFilename', () => {
        it('should not modify valid filenames', () => {
            const input = 'normal-filename.pdf';
            expect(sanitizeFilename(input)).toBe(input);
        });
    });

    describe('ensureDirectoryExists', () => {
        it('should create directory if it does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            ensureDirectoryExists('/test/dir');

            expect(fs.mkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
        });

        it('should not create directory if it already exists', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            ensureDirectoryExists('/test/dir');

            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('getAttachmentFilePath', () => {
        it('should generate correct file path', () => {
            const baseDir = '/base/dir';
            const date = dayjs('2024-01-15T14:30:00');
            const subject = 'Test Subject';
            const attachmentName = 'document.pdf';

            const result = getAttachmentFilePath(baseDir, date, subject, attachmentName);

            expect(result).toBe(path.join(baseDir, '2024', '1', 'attachments', '15-1430-Test Subject-document.pdf'));
        });

        it('should sanitize subject and attachment name', () => {
            const baseDir = '/base/dir';
            const date = dayjs('2024-01-15T14:30:00');
            const subject = 'Test: Subject?';
            const attachmentName = 'doc*ument.pdf';

            const result = getAttachmentFilePath(baseDir, date, subject, attachmentName);

            expect(result).toBe(path.join(baseDir, '2024', '1', 'attachments', '15-1430-Test- Subject--doc-ument.pdf'));
        });
    });

    describe('saveAttachment', () => {
        const mockApi = {
            getAttachment: jest.fn()
        };
        const testParams = {
            userId: 'user123',
            messageId: 'msg123',
            attachmentId: 'att123',
            filename: 'test.pdf',
            destinationDir: '/dest/dir',
            date: dayjs('2024-01-15T14:30:00'),
            subject: 'Test Email',
            dryRun: false
        };

        it('should save attachment successfully', async () => {
            const mockAttachment = {
                data: 'SGVsbG8gV29ybGQ=' // Base64 encoded "Hello World"
            };
            mockApi.getAttachment.mockResolvedValue(mockAttachment);

            const result = await saveAttachment(
                mockApi as any,
                testParams.userId,
                testParams.messageId,
                testParams.attachmentId,
                testParams.filename,
                testParams.destinationDir,
                testParams.date,
                testParams.subject,
                testParams.dryRun
            );

            expect(mockApi.getAttachment).toHaveBeenCalledWith({
                userId: testParams.userId,
                messageId: testParams.messageId,
                id: testParams.attachmentId
            });
            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(result).toContain(path.join('attachments', '15-1430-Test Email-test.pdf'));
        });

        it('should not write file in dry run mode', async () => {
            const mockAttachment = {
                data: 'SGVsbG8gV29ybGQ='
            };
            mockApi.getAttachment.mockResolvedValue(mockAttachment);

            await saveAttachment(
                mockApi as any,
                testParams.userId,
                testParams.messageId,
                testParams.attachmentId,
                testParams.filename,
                testParams.destinationDir,
                testParams.date,
                testParams.subject,
                true // dry run
            );

            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('should throw error when attachment is null', async () => {
            mockApi.getAttachment.mockResolvedValue(null);

            await expect(saveAttachment(
                mockApi as any,
                testParams.userId,
                testParams.messageId,
                testParams.attachmentId,
                testParams.filename,
                testParams.destinationDir,
                testParams.date,
                testParams.subject,
                testParams.dryRun
            )).rejects.toThrow('Attachment is null');
        });

        it('should throw error when attachment data is null', async () => {
            mockApi.getAttachment.mockResolvedValue({});

            await expect(saveAttachment(
                mockApi as any,
                testParams.userId,
                testParams.messageId,
                testParams.attachmentId,
                testParams.filename,
                testParams.destinationDir,
                testParams.date,
                testParams.subject,
                testParams.dryRun
            )).rejects.toThrow('Attachment data is null');
        });
    });
});
