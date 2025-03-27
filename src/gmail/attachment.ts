import { gmail_v1 } from 'googleapis';
import * as path from 'path';
import * as Dates from '../util/dates';
import * as Storage from '../util/storage';
import {
    DEFAULT_BINARY_TO_TEXT_ENCODING,
    DATE_FORMAT_DAY,
    DATE_FORMAT_HOURS,
    DATE_FORMAT_MINUTES,
    DATE_FORMAT_MONTH,
    DATE_FORMAT_YEAR,
    DEFAULT_CHARACTER_ENCODING,
} from '../constants';
import { Instance as GmailApiInstance } from './api.d';
export function sanitizeFilename(filename: string): string {
    // Replace characters that are invalid in filenames
    return filename.replace(/[<>:"/\\|?*]/g, '-');
}

export function getAttachmentFilePath(baseDir: string, date: Date, subject: string, attachmentName: string, timezone: string): string {
    const storage = Storage.create({});
    const dates = Dates.create({ timezone });
    const year = dates.format(date, DATE_FORMAT_YEAR);
    const month = dates.format(date, DATE_FORMAT_MONTH);
    const day = dates.format(date, DATE_FORMAT_DAY);
    const hours = dates.format(date, DATE_FORMAT_HOURS);
    const minutes = dates.format(date, DATE_FORMAT_MINUTES);

    // Get the file extension from the attachment name
    const attachmentExt = path.extname(attachmentName);
    const attachmentBaseName = path.basename(attachmentName, attachmentExt);

    const sanitizedSubject = sanitizeFilename(subject);
    const sanitizedAttachmentName = sanitizeFilename(attachmentBaseName);

    // Create filename in format: DD-HHMM-Subject-AttachmentName.ext
    const filename = `${day}-${hours}${minutes}-${sanitizedSubject}-${sanitizedAttachmentName}${attachmentExt}`;

    // Store attachments under year/month/attachments instead of a separate top-level attachments directory
    const attachmentDir = path.join(baseDir, year.toString(), month.toString(), 'attachments');
    storage.createDirectory(attachmentDir);

    return path.join(attachmentDir, filename);
}

// Add function to handle attachments
export async function saveAttachment(
    api: GmailApiInstance,
    userId: string,
    messageId: string,
    attachmentId: string,
    filename: string,
    destinationDir: string,
    date: Date,
    subject: string,
    dryRun: boolean,
    timezone: string
): Promise<string> {
    const storage = Storage.create({});
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

    const data = Buffer.from(attachment.data, DEFAULT_BINARY_TO_TEXT_ENCODING);
    const attachmentPath = getAttachmentFilePath(destinationDir, date, subject, filename, timezone);

    if (!dryRun) {
        await storage.writeFile(attachmentPath, data, DEFAULT_CHARACTER_ENCODING);
    }
    return attachmentPath;
}