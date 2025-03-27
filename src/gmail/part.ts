import { saveAttachment } from './attachment';
import { Instance as GmailApiInstance } from './api.d';

export async function processMessagePart(
    api: GmailApiInstance,
    userId: string,
    messageId: string,
    part: any,
    destinationDir: string,
    date: Date,
    subject: string,
    dryRun: boolean,
    timezone: string
): Promise<{ body?: string, mimeType?: string, attachments: string[] }> {
    const attachments: string[] = [];
    let body: string | undefined;
    let mimeType: string | undefined;

    if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
        if (part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString();
            mimeType = part.mimeType;
        }
    } else if (part.body.attachmentId) {
        // This is an attachment
        const filename = part.filename || `attachment-${Date.now()}${part.mimeType ? `.${part.mimeType.split('/')[1]}` : ''}`;
        const attachmentPath = await saveAttachment(
            api,
            userId,
            messageId,
            part.body.attachmentId,
            filename,
            destinationDir,
            date,
            subject,
            dryRun,
            timezone
        );
        attachments.push(attachmentPath);
    }

    // Recursively process nested parts
    if (part.parts) {
        let htmlContent: { body: string, mimeType: string } | undefined;
        let plainContent: { body: string, mimeType: string } | undefined;

        for (const subPart of part.parts) {
            const result = await processMessagePart(api, userId, messageId, subPart, destinationDir, date, subject, dryRun, timezone);
            if (result.body && result.mimeType) {
                if (result.mimeType === 'text/html') {
                    htmlContent = { body: result.body, mimeType: result.mimeType };
                } else if (result.mimeType === 'text/plain') {
                    plainContent = { body: result.body, mimeType: result.mimeType };
                }
            }
            attachments.push(...result.attachments);
        }

        // Prefer HTML content if available
        if (htmlContent) {
            body = htmlContent.body;
            mimeType = htmlContent.mimeType;
        } else if (plainContent) {
            body = plainContent.body;
            mimeType = plainContent.mimeType;
        }
    }

    return { body, mimeType, attachments };
}