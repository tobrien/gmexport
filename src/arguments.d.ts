export interface Input {
    currentMonth: boolean;
    dryRun: boolean;
    verbose: boolean;
    timezone: string;
    config?: string;
    outputDirectory: string;
    start?: string;
    end?: string;
    outputStructure?: string;
    filenameOptions?: string[];
    credentialsFile?: string;
    tokenFile?: string;
    apiScopes?: string[];
}

