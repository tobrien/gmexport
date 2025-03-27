
// Add this interface for label mapping
export interface GmailLabel {
    id: string;
    name: string;
    type: string;
}

// Type for the headers we care about
export interface MessageHeaders {
    from: string;
    to?: string;
    subject?: string;
    date: string;
    messageId?: string;
    deliveredTo?: string;
    replyTo?: string;
    contentType?: string;
    cc?: string;
    bcc?: string;
}