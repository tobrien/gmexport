export interface CommandLineArgs {
    config: string;
    output: string;
    start?: string;
    end?: string;
    currentMonth?: boolean;
    dryRun: boolean;
    verbose?: boolean;
}

export interface DateRange {
    start: Date;
    end: Date;
}

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
    };
    api: {
        scopes: string[];
    };
    filters: {
        exclude: MessageFilter;
        include: MessageFilter;
    };
}