import dayjs from 'dayjs';
import * as fs from 'fs';
import { gmail_v1 } from 'googleapis';
import * as path from 'path';
import * as GmailApi from './api.js';

export function sanitizeFilename(filename: string): string {
    // Replace characters that are invalid in filenames
    return filename.replace(/[<>:"/\\|?*]/g, '-');
}

export function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function getAttachmentFilePath(baseDir: string, date: dayjs.Dayjs, subject: string, attachmentName: string): string {
    const year = date.year();
    const month = date.month() + 1; // getMonth() returns 0-11
    const day = date.date();
    const hours = date.hour().toString().padStart(2, '0');
    const minutes = date.minute().toString().padStart(2, '0');

    // Get the file extension from the attachment name
    const attachmentExt = path.extname(attachmentName);
    const attachmentBaseName = path.basename(attachmentName, attachmentExt);

    const sanitizedSubject = sanitizeFilename(subject);
    const sanitizedAttachmentName = sanitizeFilename(attachmentBaseName);

    // Create filename in format: DD-HHMM-Subject-AttachmentName.ext
    const filename = `${day}-${hours}${minutes}-${sanitizedSubject}-${sanitizedAttachmentName}${attachmentExt}`;

    // Store attachments under year/month/attachments instead of a separate top-level attachments directory
    const attachmentDir = path.join(baseDir, year.toString(), month.toString(), 'attachments');
    ensureDirectoryExists(attachmentDir);

    return path.join(attachmentDir, filename);
}

// Add function to handle attachments
export async function saveAttachment(
    api: GmailApi.Instance,
    userId: string,
    messageId: string,
    attachmentId: string,
    filename: string,
    destinationDir: string,
    date: dayjs.Dayjs,
    subject: string,
    dryRun: boolean
): Promise<string> {
    const attachment: gmail_v1.Schema$MessagePartBody | null = await api.getAttachment({
        userId,
        messageId,
        id: attachmentId
    });

    if (!attachment) {
        throw new Error('Attachment is null');
    }

    if (!attachment.data) {
        throw new Error('Attachment data is null');
    }

    const data = Buffer.from(attachment.data, 'base64');
    const attachmentPath = getAttachmentFilePath(destinationDir, date, subject, filename);

    if (!dryRun) {
        fs.writeFileSync(attachmentPath, data);
    }
    return attachmentPath;
}