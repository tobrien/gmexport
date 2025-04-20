import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// Mock the saveAttachment function
// @ts-ignore
const mockSaveAttachment = jest.fn().mockImplementation(() => Promise.resolve('')) as jest.Mock<Promise<string>>;

// Mock the Gmail API instance
const mockGmailApi = {
    users: {
        messages: {
            attachments: {
                get: jest.fn()
            }
        }
    }
};

// Mock modules using jest.unstable_mockModule
jest.unstable_mockModule('../../src/gmail/attachment', () => ({
    __esModule: true,
    saveAttachment: mockSaveAttachment
}));

// Variables for dynamically imported modules
let processMessagePart: any;

// Load all dependencies before tests
beforeAll(async () => {
    const partModule = await import('../../src/gmail/part');
    processMessagePart = partModule.processMessagePart;
});

describe('Gmail Part Module', () => {
    const userId = 'user123';
    const messageId = 'msg123';
    const destinationDir = '/test/destination';
    const date = new Date('2023-01-01');
    const subject = 'Test Subject';
    const dryRun = false;
    const timezone = 'America/New_York';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should process text/html part correctly', async () => {
        const part = {
            mimeType: 'text/html',
            body: {
                data: Buffer.from('<p>Test HTML content</p>').toString('base64')
            }
        };

        const result = await processMessagePart(
            mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
        );

        expect(result.body).toBe('<p>Test HTML content</p>');
        expect(result.mimeType).toBe('text/html');
        expect(result.attachments).toEqual([]);
        expect(mockSaveAttachment).not.toHaveBeenCalled();
    });

    test('should process text/plain part correctly', async () => {
        const part = {
            mimeType: 'text/plain',
            body: {
                data: Buffer.from('Test plain text content').toString('base64')
            }
        };

        const result = await processMessagePart(
            mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
        );

        expect(result.body).toBe('Test plain text content');
        expect(result.mimeType).toBe('text/plain');
        expect(result.attachments).toEqual([]);
        expect(mockSaveAttachment).not.toHaveBeenCalled();
    });

    test('should process attachment part correctly', async () => {
        const part = {
            mimeType: 'application/pdf',
            filename: 'test.pdf',
            body: {
                attachmentId: 'attach123'
            }
        };

        mockSaveAttachment.mockResolvedValueOnce('/test/destination/test.pdf' as any);

        const result = await processMessagePart(
            mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
        );

        expect(result.body).toBeUndefined();
        expect(result.mimeType).toBeUndefined();
        expect(result.attachments).toEqual(['/test/destination/test.pdf']);
        expect(mockSaveAttachment).toHaveBeenCalledWith(
            mockGmailApi, userId, messageId, 'attach123', 'test.pdf', destinationDir, date, subject, dryRun, timezone
        );
    });

    test('should generate filename for attachment without name', async () => {
        const part = {
            mimeType: 'image/jpeg',
            body: {
                attachmentId: 'attach456'
            }
        };

        mockSaveAttachment.mockResolvedValueOnce('/test/destination/attachment.jpeg' as any);

        // Mock Date.now() to return a predictable value
        const originalDateNow = Date.now;
        const mockNow = jest.fn(() => 1234567890);
        global.Date.now = mockNow;

        try {
            await processMessagePart(
                mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
            );

            // Verify that saveAttachment was called with a generated filename
            expect(mockSaveAttachment).toHaveBeenCalledWith(
                mockGmailApi, userId, messageId, 'attach456', 'attachment-1234567890.jpeg',
                destinationDir, date, subject, dryRun, timezone
            );
        } finally {
            // Restore original Date.now
            global.Date.now = originalDateNow;
        }
    });

    test('should recursively process nested parts and prefer HTML content', async () => {
        const part = {
            mimeType: 'multipart/alternative',
            body: {},
            parts: [
                {
                    mimeType: 'text/plain',
                    body: {
                        data: Buffer.from('Plain text version').toString('base64')
                    }
                },
                {
                    mimeType: 'text/html',
                    body: {
                        data: Buffer.from('<p>HTML version</p>').toString('base64')
                    }
                }
            ]
        };

        const result = await processMessagePart(
            mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
        );

        expect(result.body).toBe('<p>HTML version</p>');
        expect(result.mimeType).toBe('text/html');
        expect(result.attachments).toEqual([]);
    });

    test('should use plain text content when HTML is not available', async () => {
        const part = {
            mimeType: 'multipart/alternative',
            body: {},
            parts: [
                {
                    mimeType: 'text/plain',
                    body: {
                        data: Buffer.from('Plain text version').toString('base64')
                    }
                }
            ]
        };

        const result = await processMessagePart(
            mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
        );

        expect(result.body).toBe('Plain text version');
        expect(result.mimeType).toBe('text/plain');
        expect(result.attachments).toEqual([]);
    });

    test('should collect attachments from nested parts', async () => {
        const part = {
            mimeType: 'multipart/mixed',
            body: {},
            parts: [
                {
                    mimeType: 'text/html',
                    body: {
                        data: Buffer.from('<p>Email body</p>').toString('base64')
                    }
                },
                {
                    mimeType: 'application/pdf',
                    filename: 'doc1.pdf',
                    body: {
                        attachmentId: 'attach1'
                    }
                },
                {
                    mimeType: 'application/pdf',
                    filename: 'doc2.pdf',
                    body: {
                        attachmentId: 'attach2'
                    }
                }
            ]
        };

        // Reset implementation for this test
        mockSaveAttachment.mockReset();
        // @ts-ignore
        mockSaveAttachment.mockImplementation((api, userId, messageId, attachmentId, filename) => {
            return Promise.resolve(`/test/destination/${filename}` as any);
        });

        const result = await processMessagePart(
            mockGmailApi, userId, messageId, part, destinationDir, date, subject, dryRun, timezone
        );

        expect(result.body).toBe('<p>Email body</p>');
        expect(result.mimeType).toBe('text/html');
        expect(result.attachments).toEqual(['/test/destination/doc1.pdf', '/test/destination/doc2.pdf']);
        expect(mockSaveAttachment).toHaveBeenCalledTimes(2);
    });
});
