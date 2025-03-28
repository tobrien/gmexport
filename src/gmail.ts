import * as fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import * as path from 'path';
import dayjs from 'dayjs';
import { Config } from './config.js';
import * as Filter from './filter.js';
import { DateRange } from './main.js';

export interface Email {
    id: string;
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    date: string;
    labels: string[];
}

// Add this interface for label mapping
interface GmailLabel {
    id: string;
    name: string;
    type: string;
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

function getEmailFilePath(baseDir: string, date: dayjs.Dayjs, subject: string, extension: string = '.txt'): string {
    const year = date.year();
    const month = date.month() + 1; // getMonth() returns 0-11
    const day = date.date();
    const hours = date.hour().toString().padStart(2, '0');
    const minutes = date.minute().toString().padStart(2, '0');

    const sanitizedSubject = sanitizeFilename(subject);
    const filename = `${day}-${hours}${minutes}-${sanitizedSubject}${extension}`;

    const dirPath = path.join(baseDir, year.toString(), month.toString());
    ensureDirectoryExists(dirPath);

    return path.join(dirPath, filename);
}

function formatDateForGmailQuery(date: dayjs.Dayjs): string {
    return date.format('YYYY/MM/DD');
}

function getAttachmentFilePath(baseDir: string, date: dayjs.Dayjs, subject: string, attachmentName: string): string {
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

// Add this function to get all labels
async function getAllLabels(gmail: any): Promise<Map<string, string>> {
    const labelMap = new Map<string, string>();
    try {
        const response = await gmail.users.labels.list({
            userId: 'me'
        });

        const labels: GmailLabel[] = response.data.labels || [];
        for (const label of labels) {
            labelMap.set(label.id, label.name);
        }
        console.log(`Retrieved ${labelMap.size} labels from Gmail`);
    } catch (error) {
        console.error('Error fetching labels:', error);
    }
    return labelMap;
}

// Add function to handle attachments
async function saveAttachment(
    gmail: any,
    userId: string,
    messageId: string,
    attachmentId: string,
    filename: string,
    destinationDir: string,
    date: dayjs.Dayjs,
    subject: string,
    dryRun: boolean
): Promise<string> {
    const attachment = await gmail.users.messages.attachments.get({
        userId,
        messageId,
        id: attachmentId
    });

    const data = Buffer.from(attachment.data.data, 'base64');
    const attachmentPath = getAttachmentFilePath(destinationDir, date, subject, filename);

    if (!dryRun) {
        fs.writeFileSync(attachmentPath, data);
    }
    return attachmentPath;
}

async function processMessagePart(
    gmail: any,
    userId: string,
    messageId: string,
    part: any,
    destinationDir: string,
    date: dayjs.Dayjs,
    subject: string,
    dryRun: boolean
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
            gmail,
            userId,
            messageId,
            part.body.attachmentId,
            filename,
            destinationDir,
            date,
            subject,
            dryRun
        );
        attachments.push(attachmentPath);
    }

    // Recursively process nested parts
    if (part.parts) {
        let htmlContent: { body: string, mimeType: string } | undefined;
        let plainContent: { body: string, mimeType: string } | undefined;

        for (const subPart of part.parts) {
            const result = await processMessagePart(gmail, userId, messageId, subPart, destinationDir, date, subject, dryRun);
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

export const create = (config: Config, auth: OAuth2Client) => {

    const filter = Filter.create(config);

    async function exportEmails(dateRange: DateRange): Promise<void> {
        const gmail = google.gmail({ version: 'v1', auth });
        let processedCount = 0;
        let skippedCount = 0;
        let attachmentCount = 0;
        let filteredCount = 0;

        try {
            // Get all labels first
            console.log('Fetching Gmail labels...');
            const labelMap = await getAllLabels(gmail);

            // Format dates for Gmail query
            const afterDate = formatDateForGmailQuery(dateRange.start);
            // Add one day to end date to make the range inclusive
            const adjustedEndDate = dateRange.end.add(1, 'day');
            const beforeDate = formatDateForGmailQuery(adjustedEndDate);

            // Construct Gmail search query
            let query = `after:${afterDate} before:${beforeDate}`;
            if (config.filters.include.labels && config.filters.include.labels.length > 0) {
                query += ` label:${config.filters.include.labels.join(' OR label:')}`;
            }
            if (config.filters.exclude.labels && config.filters.exclude.labels.length > 0) {
                query += ` -label:${config.filters.exclude.labels.join(' AND -label:')}`;
            }

            console.log('\nUsing Gmail search query:');
            console.log(`- Date range: after ${afterDate} and before ${beforeDate}`);
            if (config.filters.include.labels && config.filters.include.labels.length > 0) {
                console.log(`- Including labels: ${config.filters.include.labels.join(', ')}`);
            }
            if (config.filters.exclude.labels && config.filters.exclude.labels.length > 0) {
                console.log(`- Excluding labels: ${config.filters.exclude.labels.join(', ')}`);
            }
            console.log(`\nFull query: ${query}\n`);


            const res = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: config.export.max_results,
            });

            const messages = res.data.messages || [];
            console.log(`Found ${messages.length} messages in the specified date range`);

            if (config.export.dry_run) {
                console.log('\nDRY RUN MODE: No files will be saved\n');
            }

            for (const message of messages) {
                const emailResponse = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id!,
                    format: 'full',
                });

                const emailData = emailResponse.data;
                const headers = emailData.payload?.headers || [];
                const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
                const to = headers.find(h => h.name === 'To')?.value || 'Unknown';
                const cc = headers.find(h => h.name === 'Cc')?.value;
                const bcc = headers.find(h => h.name === 'Bcc')?.value;
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                const dateStr = headers.find(h => h.name === 'Date')?.value;

                if (!dateStr) {
                    console.warn('Skipping email with no date');
                    continue;
                }

                // Get labels for the email
                const labels = emailData.labelIds || [];
                const labelNames = labels.map(id => labelMap.get(id) || id);

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

                // Check if email should be skipped
                const skipCheck = filter.shouldSkipEmail(email);
                if (skipCheck.skip) {
                    filteredCount++;
                    if (process.env.DEBUG) {
                        console.log(`Filtered email: "${subject}" from "${from}" - ${skipCheck.reason}`);
                    }
                    continue;
                }

                const date = dayjs(dateStr);
                let body = '';
                let mimeType = 'text/plain';
                const attachmentPaths: string[] = [];

                if (emailData.payload) {
                    if (emailData.payload.body?.data) {
                        // Direct body data
                        body = Buffer.from(emailData.payload.body.data, 'base64').toString();
                        mimeType = emailData.payload.mimeType || 'text/plain';
                    } else if (emailData.payload.parts) {
                        // Process all parts including attachments
                        const result = await processMessagePart(
                            gmail,
                            'me',
                            message.id!,
                            emailData.payload,
                            config.export.destination_dir,
                            date,
                            subject,
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
                const filePath = getEmailFilePath(config.export.destination_dir, date, subject, fileExtension);

                // Check if file already exists
                if (fs.existsSync(filePath)) {
                    console.log(`Skipping existing email: ${filePath}`);
                    skippedCount++;
                    continue;
                }

                // Update the labels processing to use the label map
                const labelsStr = labelNames.join(', ');

                // Write email content with resolved label names and include attachments
                let emailContent = `From: ${from}
To: ${to}`;

                if (cc !== 'None') {
                    emailContent += `\nCc: ${cc}`;
                }
                if (bcc !== 'None') {
                    emailContent += `\nBcc: ${bcc}`;
                }

                emailContent += `\nSubject: ${subject}
Date: ${dateStr}
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
                console.log(`${config.export.dry_run ? '[DRY RUN] Would export' : 'Exported'} email to: ${filePath} (${mimeType})`);
            }

            console.log(`\nExport complete:`);
            console.log(`- Processed: ${processedCount} emails`);
            console.log(`- Skipped (existing): ${skippedCount} files`);
            console.log(`- Filtered (rules): ${filteredCount} emails`);
            console.log(`- Attachments ${config.export.dry_run ? 'would be saved' : 'saved'}: ${attachmentCount}`);
            console.log(`- Total found: ${messages.length} emails`);
            if (config.export.dry_run) {
                console.log('\nThis was a dry run. No files were actually saved.');
            }
        } catch (error) {
            console.error('Error fetching emails:', error);
        }
    }

    return {
        exportEmails: exportEmails
    };
}
