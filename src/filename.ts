import { DATE_FORMAT_DAY, DATE_FORMAT_MONTH_DAY, DATE_FORMAT_YEAR_MONTH_DAY } from './constants';
import * as Dates from './util/dates';
import { FilenameOption, OutputStructure } from '@tobrien/cabazooka';
export function formatFilename(
    messageId: string,
    date: Date,
    subject: string,
    timezone: string,
    filenameOptions: FilenameOption[],
    outputStructure: OutputStructure
): string {
    const parts: string[] = [];

    // Add date if requested
    if (filenameOptions?.includes('date')) {
        const dateStr = formatDateForFilename(date, outputStructure, timezone);
        parts.push(dateStr);
    }

    // Add time if requested
    if (filenameOptions?.includes('time')) {
        const dates = Dates.create({ timezone });
        const timeStr = dates.format(date, 'HHmm');
        parts.push(timeStr);
    }

    // Add message ID
    parts.push(messageId);

    // Add subject if requested
    if (filenameOptions?.includes('subject')) {
        const safeSubject = makeSubjectSafe(subject);
        parts.push(safeSubject);
    }

    return parts.join('-') + '.eml';
}

function formatDateForFilename(date: Date, outputStructure: 'none' | 'year' | 'month' | 'day', timezone: string): string {
    const dates = Dates.create({ timezone });
    switch (outputStructure) {
        case 'none':
            return dates.format(date, DATE_FORMAT_YEAR_MONTH_DAY);
        case 'year':
            return dates.format(date, DATE_FORMAT_MONTH_DAY);
        case 'month':
            return dates.format(date, DATE_FORMAT_DAY);
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