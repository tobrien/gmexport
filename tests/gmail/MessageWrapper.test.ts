import { gmail_v1 } from 'googleapis';
import MessageWrapper from '../../src/gmail/MessageWrapper.js';

describe('MessageWrapper', () => {
    const mockHeaders: gmail_v1.Schema$MessagePartHeader[] = [
        { name: 'Date', value: 'Wed, 15 Mar 2024 10:00:00 GMT' },
        { name: 'From', value: 'sender@example.com' },
        { name: 'To', value: 'recipient@example.com' },
        { name: 'Subject', value: 'Test Email' },
        { name: 'Message-ID', value: '<123456789@example.com>' },
        { name: 'Delivered-To', value: 'recipient@example.com' },
        { name: 'Reply-To', value: 'reply@example.com' },
        { name: 'Content-Type', value: 'text/plain' },
        { name: 'Cc', value: 'cc@example.com' },
        { name: 'Bcc', value: 'bcc@example.com' }
    ];

    const mockMessage: gmail_v1.Schema$Message = {
        payload: {
            headers: mockHeaders
        }
    };

    describe('constructor', () => {
        it('should successfully create a MessageWrapper with valid headers', () => {
            const wrapper = new MessageWrapper(mockMessage);
            expect(wrapper).toBeDefined();
        });

        it('should throw error when headers are missing', () => {
            const invalidMessage: gmail_v1.Schema$Message = {
                payload: {}
            };
            expect(() => new MessageWrapper(invalidMessage)).toThrow('Message is missing headers');
        });

        it('should throw error when Date header is missing', () => {
            const invalidHeaders = mockHeaders.filter(h => h.name !== 'Date');
            const invalidMessage: gmail_v1.Schema$Message = {
                payload: { headers: invalidHeaders }
            };
            expect(() => new MessageWrapper(invalidMessage)).toThrow('Message is missing Date header');
        });

        it('should throw error when From header is missing', () => {
            const invalidHeaders = mockHeaders.filter(h => h.name !== 'From');
            const invalidMessage: gmail_v1.Schema$Message = {
                payload: { headers: invalidHeaders }
            };
            expect(() => new MessageWrapper(invalidMessage)).toThrow('Message is missing From header');
        });
    });

    describe('getters', () => {
        let wrapper: MessageWrapper;

        beforeEach(() => {
            wrapper = new MessageWrapper(mockMessage);
        });

        it('should return correct from address', () => {
            expect(wrapper.from).toBe('sender@example.com');
        });

        it('should return correct to address', () => {
            expect(wrapper.to).toBe('recipient@example.com');
        });

        it('should return correct subject', () => {
            expect(wrapper.subject).toBe('Test Email');
        });

        it('should return correct date', () => {
            expect(wrapper.date).toBe('Wed, 15 Mar 2024 10:00:00 GMT');
        });

        it('should return correct message ID', () => {
            expect(wrapper.messageId).toBe('<123456789@example.com>');
        });

        it('should return correct delivered-to address', () => {
            expect(wrapper.deliveredTo).toBe('recipient@example.com');
        });

        it('should return correct reply-to address', () => {
            expect(wrapper.replyTo).toBe('reply@example.com');
        });

        it('should return correct content type', () => {
            expect(wrapper.contentType).toBe('text/plain');
        });

        it('should return correct cc address', () => {
            expect(wrapper.cc).toBe('cc@example.com');
        });

        it('should return correct bcc address', () => {
            expect(wrapper.bcc).toBe('bcc@example.com');
        });

        it('should return undefined for optional headers when missing', () => {
            const messageWithoutOptionalHeaders: gmail_v1.Schema$Message = {
                payload: {
                    headers: [
                        { name: 'Date', value: 'Wed, 15 Mar 2024 10:00:00 GMT' },
                        { name: 'From', value: 'sender@example.com' }
                    ]
                }
            };
            const wrapper = new MessageWrapper(messageWithoutOptionalHeaders);

            expect(wrapper.to).toBeUndefined();
            expect(wrapper.subject).toBeUndefined();
            expect(wrapper.messageId).toBeUndefined();
            expect(wrapper.deliveredTo).toBeUndefined();
            expect(wrapper.replyTo).toBeUndefined();
            expect(wrapper.contentType).toBeUndefined();
            expect(wrapper.cc).toBeUndefined();
            expect(wrapper.bcc).toBeUndefined();
        });
    });

    describe('raw message access', () => {
        it('should return the raw message object', () => {
            const wrapper = new MessageWrapper(mockMessage);
            expect(wrapper.raw).toBe(mockMessage);
        });
    });
});
