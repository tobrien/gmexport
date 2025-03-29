import * as fs from 'fs';
import { gmail_v1 } from 'googleapis';
import * as path from 'path';
import * as Filter from './filter.js';
import * as GmailApi from './gmail/api.js';
import { createQuery } from './gmail/query.js';
import { getLogger } from './logging.js';
import { Configuration, DateRange } from './types.js';
import dayjs from 'dayjs';
import * as Filename from './filename.js';
import MessageWrapper from './MessageWrapper.js';

// Import dayjs plugins
const utc = await import('dayjs/plugin/utc.js');
const timezone = await import('dayjs/plugin/timezone.js');

dayjs.extend(utc.default);
dayjs.extend(timezone.default);

export interface Instance {
    exportEmails: (dateRange: DateRange) => Promise<void>;

    // I dislike exporting these functions, but do so to make testing easier.
    printExportSummary: (messages: any, processedCount: number, skippedCount: number, filteredCount: number, attachmentCount: number, dryRun: boolean) => void;
}

function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getEmailFilePath(baseDir: string, messageId: string, dateHeader: string, outputStructure: 'year' | 'month' | 'day', subject: string, config: Configuration): string {
    const date = dayjs(dateHeader);
    const year = date.year();
    const month = date.format('MM');
    const day = date.format('DD');

    let dirPath: string;
    switch (outputStructure) {
        case 'year':
            dirPath = path.join(baseDir, year.toString());
            break;
        case 'month':
            dirPath = path.join(baseDir, year.toString(), month);
            break;
        case 'day':
            dirPath = path.join(baseDir, year.toString(), month, day);
            break;
        default:
            dirPath = baseDir;
    }

    ensureDirectoryExists(dirPath);
    const filename = Filename.formatFilename(messageId, date.toDate(), subject, config);
    return path.join(dirPath, filename);
}

function foldHeaderLine(name: string, value: string): string {
    const maxLength = 78;
    const indent = ' '; // Standard space for folded lines

    // Initial line has format "Name: Value"
    let result = `${name}: ${value}`;

    // If the line is already short enough, return as is
    if (result.length <= maxLength) {
        return result;
    }

    // Calculate available space for first line (accounting for "Name: ")
    const firstLineMax = maxLength - name.length - 2;
    result = `${name}: ${value.substring(0, firstLineMax)}`;
    let remainingValue = value.substring(firstLineMax);

    // Fold remaining content
    while (remainingValue.length > 0) {
        const chunk = remainingValue.substring(0, maxLength - indent.length);
        result += `\r\n${indent}${chunk}`;
        remainingValue = remainingValue.substring(chunk.length);
    }

    return result;
}

export const create = (config: Configuration, api: GmailApi.Instance): Instance => {
    const logger = getLogger();
    const filter = Filter.create(config);
    const userId = 'me';

    let processedCount = 0;
    let skippedCount = 0;
    let filteredCount = 0;
    let errorCount = 0;

    async function processMessage(message: gmail_v1.Schema$Message): Promise<void> {
        const messageId = message.id;

        const messageMetadata = await api.getMessage({
            userId,
            id: messageId!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Message-ID', 'Delivered-To', 'Reply-To', 'Content-Type', 'Cc', 'Bcc']
        });

        if (!messageMetadata) {
            logger.error('Skipping message with no metadata: %s', messageId);
            errorCount++;
            return;
        }

        console.error('Processing message: %s', messageId);

        try {
            // Wrap the message metadata in a wrapper class to reduce the amount of code needed to access the message metadata
            const wrappedMessage = new MessageWrapper(messageMetadata);

            console.error('Wrapped message: %j', wrappedMessage);
            // Check if email should be skipped
            const skipCheck = filter.shouldSkipEmail(wrappedMessage);
            if (skipCheck.skip) {
                filteredCount++;
                logger.debug('Filtered email: %s %j', skipCheck.reason, wrappedMessage);
                return;
            }

            const filePath = getEmailFilePath(
                config.export.destination_dir,
                messageId!,
                wrappedMessage.date,
                config.export.output_structure,
                wrappedMessage.subject || 'No Subject',
                config
            );

            console.error('File path: %s', filePath);

            // Skip if file already exists
            if (fs.existsSync(filePath)) {
                console.error('Skipping existing file: %s', filePath);
                logger.debug('Skipping existing file: %s', filePath);
                skippedCount++;
                return;
            }

            console.error('Getting raw message');
            const messageRaw: gmail_v1.Schema$Message | null = await api.getMessage({ userId, id: messageId!, format: 'raw' });
            if (!messageRaw) {
                logger.error('Skipping raw export for message with no data: %s', messageId);
                errorCount++;
                return;
            }

            const gmExportHeaders: string = [
                foldHeaderLine('GmExport-Id', messageId!),
                foldHeaderLine('GmExport-LabelIds', messageRaw.labelIds?.join(',') || ''),
                foldHeaderLine('GmExport-ThreadId', messageRaw.threadId || ''),
                foldHeaderLine('GmExport-Snippet', messageRaw.snippet || ''),
                foldHeaderLine('GmExport-SizeEstimate', String(messageRaw.sizeEstimate || '')),
                foldHeaderLine('GmExport-HistoryId', String(messageRaw.historyId || '')),
                foldHeaderLine('GmExport-InternalDate', String(messageRaw.internalDate || ''))
            ].join('\n');

            const rowMessage = Buffer.from(messageRaw.raw!, 'base64').toString('utf-8');
            fs.writeFileSync(filePath, gmExportHeaders + '\n' + rowMessage);
            logger.info('Exported email: %s', filePath);
            processedCount++;
        } catch (error) {
            logger.error('Error processing message %s: %s', messageId, error);
            errorCount++;
        }
    }

    async function exportEmails(dateRange: DateRange): Promise<void> {
        try {
            const query = createQuery(dateRange, config);
            console.error('List Messages');
            await api.listMessages({ userId, q: query, maxResults: config.export.max_results }, async (messageBatch) => {
                logger.info('Processing %d messages', messageBatch.length);
                // Process all messages in the batch concurrently
                await Promise.all(messageBatch.map(message => processMessage(message)));
            });

            printExportSummary();

            if (config.export.dry_run) {
                logger.info('This was a dry run. No files were actually saved.');
            }
        } catch (error: any) {
            logger.error('Error fetching emails: %s %s', error.message, error.stack);
            throw error;
        }
    }

    function printExportSummary() {
        logger.info('Export Summary:');
        logger.info(`\tTotal messages found: ${processedCount + skippedCount + filteredCount + errorCount}`);
        logger.info(`\tSuccessfully processed: ${processedCount}`);
        logger.info(`\tSkipped (already exists): ${skippedCount}`);
        logger.info(`\tFiltered out: ${filteredCount}`);
        logger.info(`\tErrors: ${errorCount}`);
        logger.info(`\tDry run mode: ${config.export.dry_run ? 'Yes' : 'No'}`);
    }

    return {
        exportEmails: exportEmails,

        // Note that I dislike exporting these, but it's for testing purposes
        printExportSummary: printExportSummary,
    };
}