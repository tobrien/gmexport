import * as fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import * as path from 'path';
import { Config } from './config';

interface Email {
    from: string;
    subject: string;
    date: string;
    body: string;
    attachments?: {
        filename: string;
        mimeType: string;
        size: number;
        data: Buffer;
    }[];
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

function getEmailFilePath(baseDir: string, date: Date, subject: string, extension: string = '.txt'): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    const sanitizedSubject = sanitizeFilename(subject);
    const filename = `${day}-${hours}${minutes}-${sanitizedSubject}${extension}`;

    const dirPath = path.join(baseDir, year.toString(), month.toString());
    ensureDirectoryExists(dirPath);

    return path.join(dirPath, filename);
}

function formatDateForGmailQuery(date: Date): string {
    // Format date as YYYY/MM/DD
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

function getAttachmentFilePath(baseDir: string, date: Date, subject: string, attachmentName: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

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
    date: Date,
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
    date: Date,
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

    // Add function to check if email should be skipped
    function shouldSkipEmail(from: string, subject: string, labels: string[]): { skip: boolean; reason?: string } {
        // Check labels
        if (labels.some((label: string) => config.filters.skip_labels.includes(label))) {
            return { skip: true, reason: 'Skipped label' };
        }

        // Check from patterns
        if (config.filters.skip_emails.from.some((pattern: string) => new RegExp(pattern, 'i').test(from))) {
            return { skip: true, reason: 'Skipped sender pattern' };
        }

        // Check subject patterns
        if (config.filters.skip_emails.subject.some((pattern: string) => new RegExp(pattern, 'i').test(subject))) {
            return { skip: true, reason: 'Skipped subject pattern' };
        }

        return { skip: false };
    }

    async function exportEmails(): Promise<void> {
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
            const afterDate = formatDateForGmailQuery(new Date(config.export.start_date));
            // Add one day to end date to make the range inclusive
            const adjustedEndDate = new Date(config.export.end_date);
            adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
            const beforeDate = formatDateForGmailQuery(adjustedEndDate);

            // Construct Gmail search query
            let query = `after:${afterDate} before:${beforeDate}`;
            if (config.filters.skip_labels.length > 0) {
                query += ` label:${config.filters.skip_labels.join(' OR label:')}`;
            }
            console.log(`Searching for emails between ${afterDate} and ${beforeDate}${config.filters.skip_labels.length > 0 ? ` with label "${config.filters.skip_labels.join(' OR label:')}"` : ''}`);

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
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id!,
                    format: 'full',
                });

                const headers = email.data.payload?.headers || [];
                const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
                const to = headers.find(h => h.name === 'To')?.value || 'Unknown';
                const cc = headers.find(h => h.name === 'Cc')?.value || 'None';
                const bcc = headers.find(h => h.name === 'Bcc')?.value || 'None';
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                const dateStr = headers.find(h => h.name === 'Date')?.value;

                if (!dateStr) {
                    console.warn('Skipping email with no date');
                    continue;
                }

                // Get labels for the email
                const labels = email.data.labelIds || [];
                const labelNames = labels.map(id => labelMap.get(id) || id);

                // Check if email should be skipped
                const skipCheck = shouldSkipEmail(from, subject, labelNames);
                if (skipCheck.skip) {
                    filteredCount++;
                    if (process.env.DEBUG) {
                        console.log(`Filtered email: "${subject}" from "${from}" - ${skipCheck.reason}`);
                    }
                    continue;
                }

                const date = new Date(dateStr);
                let body = '';
                let mimeType = 'text/plain';
                const attachmentPaths: string[] = [];

                if (email.data.payload) {
                    if (email.data.payload.body?.data) {
                        // Direct body data
                        body = Buffer.from(email.data.payload.body.data, 'base64').toString();
                        mimeType = email.data.payload.mimeType || 'text/plain';
                    } else if (email.data.payload.parts) {
                        // Process all parts including attachments
                        const result = await processMessagePart(
                            gmail,
                            'me',
                            message.id!,
                            email.data.payload,
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
