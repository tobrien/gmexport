import { DateRange } from './run';

export interface Instance {
    exportEmails: (dateRange: DateRange) => Promise<void>;

    // I dislike exporting these functions, but do so to make testing easier.
    printExportSummary: (messages: any, processedCount: number, skippedCount: number, filteredCount: number, attachmentCount: number, dryRun: boolean) => void;
}