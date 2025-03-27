import { gmail_v1 } from 'googleapis';
import { MessageHeaders } from '../types';

// Wrapper class to make header access more ergonomic
export default class MessageWrapper {
    private headers: MessageHeaders;
    private rawMessage: gmail_v1.Schema$Message;

    constructor(message: gmail_v1.Schema$Message) {
        this.rawMessage = message;
        this.headers = this.extractHeaders(message);
    }

    private extractHeaders(message: gmail_v1.Schema$Message): MessageHeaders {
        const headers = message.payload?.headers;
        if (!headers) {
            throw new Error('Message is missing headers');
        }
        const date = this.findHeader(headers, 'Date');
        if (!date) {
            throw new Error('Message is missing Date header');
        }
        const from = this.findHeader(headers, 'From');
        if (!from) {
            throw new Error('Message is missing From header');
        }
        const messageId = this.findHeader(headers, 'Message-ID');
        const to = this.findHeader(headers, 'To');
        const subject = this.findHeader(headers, 'Subject');
        const deliveredTo = this.findHeader(headers, 'Delivered-To');
        const replyTo = this.findHeader(headers, 'Reply-To');
        const contentType = this.findHeader(headers, 'Content-Type');
        const cc = this.findHeader(headers, 'Cc');
        const bcc = this.findHeader(headers, 'Bcc');

        return {
            messageId,
            date,
            from,
            to,
            subject,
            deliveredTo,
            replyTo,
            contentType,
            cc,
            bcc,
        };
    }

    private findHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | undefined {
        const header = headers.find(h => h.name === name);
        return header?.value || undefined;
    }
    // Getters for headers
    get from(): string { return this.headers.from; }
    get to(): string | undefined { return this.headers.to; }
    get subject(): string | undefined { return this.headers.subject; }
    get date(): string { return this.headers.date!; }
    get messageId(): string { return this.headers.messageId!; }
    get deliveredTo(): string | undefined { return this.headers.deliveredTo; }
    get replyTo(): string | undefined { return this.headers.replyTo; }
    get contentType(): string | undefined { return this.headers.contentType; }
    get cc(): string | undefined { return this.headers.cc; }
    get bcc(): string | undefined { return this.headers.bcc; }

    // Get the raw message for when we need it
    get raw(): gmail_v1.Schema$Message {
        return this.rawMessage;
    }
}