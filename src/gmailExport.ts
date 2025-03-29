import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import * as Filter from './filter.js';
import { processMessagePart } from './gmail/part.js';
import { createQuery } from './gmail/query.js';
import { getLogger } from './logging.js';
import { Configuration, DateRange, Email } from './types';
import * as GmailApi from './gmail/api.js';
import { gmail_v1 } from 'googleapis';
import { gmail } from 'googleapis/build/src/apis/gmail/index.js';

export interface Instance {
    exportEmails: (dateRange: DateRange) => Promise<void>;

    // I dislike exporting these functions, but do so to make testing easier.
    readEmail: (message: gmail_v1.Schema$Message, labelMap: Map<string, string>) => Email | null;
    printExportSummary: (messages: any, processedCount: number, skippedCount: number, filteredCount: number, attachmentCount: number, dryRun: boolean) => void;
}


function sanitizeFilename(filename: string): string {
    // Replace characters that are invalid in filenames
    return filename.replace(/[<>:"/\\|?*]/g, '-');
}

function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getEmailFilePath(baseDir: string, date: Date, subject: string, extension: string = '.txt'): string {
    const year = dayjs(date).year();
    const month = dayjs(date).month() + 1; // getMonth() returns 0-11
    const day = dayjs(date).date();
    const hours = dayjs(date).hour().toString().padStart(2, '0');
    const minutes = dayjs(date).minute().toString().padStart(2, '0');

    const sanitizedSubject = sanitizeFilename(subject);
    const filename = `${day}-${hours}${minutes}-${sanitizedSubject}${extension}`;

    const dirPath = path.join(baseDir, year.toString(), month.toString());
    ensureDirectoryExists(dirPath);

    return path.join(dirPath, filename);
}

export const create = (config: Configuration, api: GmailApi.Instance): Instance => {
    const logger = getLogger();
    const filter = Filter.create(config);

    async function exportEmails(dateRange: DateRange): Promise<void> {
        let processedCount = 0;
        let skippedCount = 0;
        let attachmentCount = 0;
        let filteredCount = 0;

        try {

            // All queries are performed to retrieve the authenticated users data.
            const userId: string = 'me';

            // Get all labels first
            logger.info('Fetching Gmail labels...');
            const labels: gmail_v1.Schema$Label[] = await api.listLabels({ userId });
            logger.info('... %d Gmail labels fetched', labels.length);

            const labelMap = new Map<string, string>();
            for (const label of labels) {
                labelMap.set(label.id!, label.name!);
            }

            if (config.export.dry_run) {
                logger.info('DRY RUN MODE: No files will be saved');
            }


            const query = createQuery(dateRange, config);
            const messages: gmail_v1.Schema$Message[] = [];
            await api.listMessages({ userId, q: query, maxResults: config.export.max_results }, (messageBatch) => {
                messages.push(...messageBatch);
                logger.debug('Fetched %d messages', messages.length);
            });

            for (const messageId of messages.map((message) => message.id)) {
                logger.debug('Processing message: %s', messageId);
                if (!messageId) {
                    logger.warn('Skipping message with no ID');
                    continue;
                }

                const message: gmail_v1.Schema$Message | null = await api.getMessage({ userId, id: messageId });
                if (!message) {
                    logger.warn('Skipping message with no data');
                    continue;
                }

                const email = readEmail(message, labelMap);
                if (!email) {
                    logger.debug('Skipping message');
                    continue;
                }

                // Check if email should be skipped
                const skipCheck = filter.shouldSkipEmail(email);
                if (skipCheck.skip) {
                    filteredCount++;
                    logger.debug('Filtered email:', {
                        subject: email.subject,
                        to: email.to,
                        from: email.from,
                        reason: skipCheck.reason
                    });
                    continue;
                }

                const date = email.date;
                let body = '';
                let mimeType = 'text/plain';
                const attachmentPaths: string[] = [];

                if (message.payload) {
                    if (message.payload.body?.data) {
                        // Direct body data
                        body = Buffer.from(message.payload.body.data, 'base64').toString();
                        mimeType = message.payload.mimeType || 'text/plain';
                    } else if (message.payload.parts) {
                        // Process all parts including attachments
                        const result = await processMessagePart(
                            api,
                            'me',
                            message.id!,
                            message.payload,
                            config.export.destination_dir,
                            dayjs(date).toDate(),
                            email.subject,
                            config.export.dry_run
                        );
                        if (result.body) {
                            body = result.body;
                            mimeType = result.mimeType || 'text/plain';
                        }
                        attachmentPaths.push(...result.attachments);
                    }
                }

                // Get file extension based on mime type
                const fileExtension = mimeType === 'text/html' ? '.html' : '.txt';
                const filePath = getEmailFilePath(config.export.destination_dir, dayjs(date).toDate(), email.subject, fileExtension);

                // Check if file already exists
                if (fs.existsSync(filePath)) {
                    logger.info('Skipping existing email: %s', filePath);
                    skippedCount++;
                    continue;
                }

                // Update the labels processing to use the label map
                const labelsStr = email.labels.join(', ');

                // Write email content with resolved label names and include attachments
                let emailContent = `From: ${email.from}
To: ${email.to}`;

                if (email.cc) {
                    emailContent += `\nCc: ${email.cc}`;
                }
                if (email.bcc) {
                    emailContent += `\nBcc: ${email.bcc}`;
                }

                emailContent += `\nSubject: ${email.subject}
Date: ${email.date}
Labels: ${labelsStr}
Content-Type: ${mimeType}`;

                if (attachmentPaths.length > 0) {
                    emailContent += `\nAttachments:\n${attachmentPaths.join('\n')}`;
                    attachmentCount += attachmentPaths.length;
                }

                emailContent += `\n\n${body}`;

                if (!config.export.dry_run) {
                    fs.writeFileSync(filePath, emailContent);
                }
                processedCount++;
                logger.info(`${config.export.dry_run ? '[DRY RUN] Would export' : 'Exported'} email: %s %s`,
                    filePath,
                    mimeType);
            }

            printExportSummary(messages, processedCount, skippedCount, filteredCount, attachmentCount, config.export.dry_run);

            if (config.export.dry_run) {
                logger.info('This was a dry run. No files were actually saved.');
            }
        } catch (error: any) {
            logger.error('Error fetching emails: %s %s', error.message, error.stack);
        }
    }

    function printExportSummary(messages: any, processedCount: number, skippedCount: number, filteredCount: number, attachmentCount: number, dryRun: boolean) {
        logger.info('Export Summary:');
        logger.info(`\tTotal messages found: ${messages.length}`);
        logger.info(`\tSuccessfully processed: ${processedCount}`);
        logger.info(`\tSkipped (already exists): ${skippedCount}`);
        logger.info(`\tFiltered out: ${filteredCount}`);
        logger.info(`\tAttachments saved: ${attachmentCount}`);
        logger.info(`\tDry run mode: ${dryRun ? 'Yes' : 'No'}`);
    }

    const readEmail = (message: gmail_v1.Schema$Message, labelMap: Map<string, string>) => {
        const emailData = message;
        const headers = emailData.payload?.headers || [];
        const from = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'From')?.value || 'Unknown';
        const to = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'To')?.value || 'Unknown';
        const cc = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Cc')?.value;
        const bcc = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Bcc')?.value;
        const subject = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Subject')?.value || 'No Subject';
        const dateStr = headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Date')?.value;

        if (!dateStr) {
            logger.warn('Skipping email with no date');
            return null;
        }

        // Get labels for the email
        const labelNames = message.labelIds?.map(id => labelMap.get(id) || id) || [];

        const email: Email = {
            id: message.id!,
            from: from,
            to: to,
            cc: cc || undefined,
            bcc: bcc || undefined,
            subject: subject,
            date: dateStr,
            labels: labelNames
        };

        return email;
    }

    return {
        exportEmails: exportEmails,

        // Note that I dislike exporting these, but it's for testing purposes
        printExportSummary: printExportSummary,
        readEmail: readEmail,
    };
}