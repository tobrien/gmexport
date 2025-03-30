export type FilenameOption = 'date' | 'time' | 'subject';

export interface CommandLineArgs {
    config?: string;
    output: string;
    start?: string;
    end?: string;
    currentMonth?: boolean;
    dryRun: boolean;
    verbose?: boolean;
    outputStructure?: 'year' | 'month' | 'day';
    filenameOptions?: string;
}

export interface DateRange {
    start: Date;
    end: Date;
}

// Add this interface for label mapping
export interface GmailLabel {
    id: string;
    name: string;
    type: string;
}

export interface MessageFilter {
    labels?: string[];
    from?: string[];
    to?: string[];
    subject?: string[];
}

// Type for the headers we care about
export interface MessageHeaders {
    from: string;
    to?: string;
    subject?: string;
    date: string;
    messageId?: string;
    deliveredTo?: string;
    replyTo?: string;
    contentType?: string;
    cc?: string;
    bcc?: string;
}

// Configuration type definition
export interface Configuration {
    credentials: {
        credentials_file: string;
        token_file: string;
    };
    export: {
        max_results: number;
        destination_dir: string;
        dry_run: boolean;
        output_structure: 'year' | 'month' | 'day';
        filename_options?: FilenameOption[];
        timezone: string;
    };
    api: {
        scopes: string[];
    };
    filters: {
        exclude: MessageFilter;
        include: MessageFilter;
    };
}