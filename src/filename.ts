import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { Configuration } from './types.js';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export function formatFilename(
    messageId: string,
    date: Date,
    subject: string,
    config: Configuration
): string {
    const parts: string[] = [];

    // Add date if requested
    if (config.export.filename_options?.includes('date')) {
        const dateStr = formatDateForFilename(date, config.export.output_structure, config.export.timezone);
        parts.push(dateStr);
    }

    // Add time if requested
    if (config.export.filename_options?.includes('time')) {
        const timeStr = dayjs(date).tz(config.export.timezone).format('HHmm');
        parts.push(timeStr);
    }

    // Add message ID
    parts.push(messageId);

    // Add subject if requested
    if (config.export.filename_options?.includes('subject')) {
        const safeSubject = makeSubjectSafe(subject);
        parts.push(safeSubject);
    }

    return parts.join('-') + '.eml';
}

function formatDateForFilename(date: Date, outputStructure: 'year' | 'month' | 'day', timezone: string): string {
    switch (outputStructure) {
        case 'year':
            return dayjs(date).tz(timezone).format('MM-DD');
        case 'month':
            return dayjs(date).tz(timezone).format('DD');
        case 'day':
            throw new Error('Cannot use date in filename when output structure is "day"');
    }
}

function makeSubjectSafe(subject: string): string {
    // Remove or replace unsafe characters
    return subject
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove all non-alphanumeric chars except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase() // Convert to lowercase
        .slice(0, 50); // Limit length to 50 characters
} 