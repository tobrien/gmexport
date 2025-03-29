import dayjs from 'dayjs';
import * as fs from 'fs';
import { jest } from '@jest/globals';
import { processMessagePart } from '../../src/gmail/part.js';

jest.mock('fs');

describe('processMessagePart', () => {
    const mockApi = {
        getAttachment: jest.fn()
    };

    const baseParams = {
        userId: 'user123',
        messageId: 'msg123',
        destinationDir: '/test/dir',
        date: new Date('2024-01-15T14:30:00'),
        subject: 'Test Email',
        dryRun: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should process text/html part', async () => {
        const part = {
            mimeType: 'text/html',
            body: {
                data: Buffer.from('<p>Hello World</p>').toString('base64')
            }
        };

        const result = await processMessagePart(
            mockApi as any,
            baseParams.userId,
            baseParams.messageId,
            part,
            baseParams.destinationDir,
            baseParams.date,
            baseParams.subject,
            baseParams.dryRun
        );

        expect(result.body).toBe('<p>Hello World</p>');
        expect(result.mimeType).toBe('text/html');
        expect(result.attachments).toEqual([]);
    });

    it('should process text/plain part', async () => {
        const part = {
            mimeType: 'text/plain',
            body: {
                data: Buffer.from('Hello World').toString('base64')
            }
        };

        const result = await processMessagePart(
            mockApi as any,
            baseParams.userId,
            baseParams.messageId,
            part,
            baseParams.destinationDir,
            baseParams.date,
            baseParams.subject,
            baseParams.dryRun
        );

        expect(result.body).toBe('Hello World');
        expect(result.mimeType).toBe('text/plain');
        expect(result.attachments).toEqual([]);
    });

    it('should process attachment part', async () => {
        const part = {
            mimeType: 'application/pdf',
            filename: 'test.pdf',
            body: {
                attachmentId: 'att123'
            }
        };

        // @ts-ignore
        mockApi.getAttachment.mockResolvedValue({
            data: 'SGVsbG8gV29ybGQ=' // Base64 encoded "Hello World"
        });

        const result = await processMessagePart(
            mockApi as any,
            baseParams.userId,
            baseParams.messageId,
            part,
            baseParams.destinationDir,
            baseParams.date,
            baseParams.subject,
            baseParams.dryRun
        );

        expect(result.body).toBeUndefined();
        expect(result.mimeType).toBeUndefined();
        expect(result.attachments).toHaveLength(1);
        expect(result.attachments[0]).toContain('test.pdf');
    });

    it('should process nested parts preferring HTML over plain text', async () => {
        const part = {
            mimeType: 'multipart/alternative',
            body: {},
            parts: [
                {
                    mimeType: 'text/plain',
                    body: {
                        data: Buffer.from('Hello World Plain').toString('base64')
                    }
                },
                {
                    mimeType: 'text/html',
                    body: {
                        data: Buffer.from('<p>Hello World HTML</p>').toString('base64')
                    }
                }
            ]
        };

        const result = await processMessagePart(
            mockApi as any,
            baseParams.userId,
            baseParams.messageId,
            part,
            baseParams.destinationDir,
            baseParams.date,
            baseParams.subject,
            baseParams.dryRun
        );

        expect(result.body).toBe('<p>Hello World HTML</p>');
        expect(result.mimeType).toBe('text/html');
        expect(result.attachments).toEqual([]);
    });

    it('should handle nested parts with attachments', async () => {
        const part = {
            mimeType: 'multipart/mixed',
            body: {},
            parts: [
                {
                    mimeType: 'text/html',
                    body: {
                        data: Buffer.from('<p>Hello World</p>').toString('base64')
                    }
                },
                {
                    mimeType: 'application/pdf',
                    filename: 'test.pdf',
                    body: {
                        attachmentId: 'att123'
                    }
                }
            ]
        };

        // @ts-ignore
        mockApi.getAttachment.mockResolvedValue({
            data: 'SGVsbG8gV29ybGQ='
        });

        const result = await processMessagePart(
            mockApi as any,
            baseParams.userId,
            baseParams.messageId,
            part,
            baseParams.destinationDir,
            baseParams.date,
            baseParams.subject,
            baseParams.dryRun
        );

        expect(result.body).toBe('<p>Hello World</p>');
        expect(result.mimeType).toBe('text/html');
        expect(result.attachments).toHaveLength(1);
        expect(result.attachments[0]).toContain('test.pdf');
    });
});
