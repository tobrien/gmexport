import { Command } from "commander";
import { DEFAULT_CURRENT_MONTH, DEFAULT_DRY_RUN, DEFAULT_VERBOSE, PROGRAM_NAME, VERSION } from "./constants";
import { Cabazooka, Input as CabazookaInput } from "@tobrien/cabazooka";

export interface Input extends CabazookaInput {
    currentMonth: boolean;
    dryRun: boolean;
    verbose: boolean;
    config?: string;
    start?: string;
    end?: string;
    credentialsFile?: string;
    tokenFile?: string;
    apiScopes?: string[];
}

export const configure = async (program: Command, cabazooka: Cabazooka): Promise<Command> => {
    let retProgram = program;
    retProgram
        .name(PROGRAM_NAME)
        .summary('Export Gmail messages within a date range to local files')
        .description('Export Gmail messages within a date range to local files')
        .option('--start <date>', 'start date (YYYY-MM-DD). If omitted, defaults to 31 days before end date')
        .option('--end <date>', 'end date (YYYY-MM-DD). If omitted, defaults to current date')
        .option('--current-month', 'export emails from the first day of the current month to today, cannot be used together with either --start or --end options', DEFAULT_CURRENT_MONTH)
        .option('--dry-run', 'perform a dry run without saving files', DEFAULT_DRY_RUN)
        .option('--verbose', 'enable debug logging', DEFAULT_VERBOSE)
        .option('--config <path>', 'Path to configuration file')
        .option('--credentials-file <path>', 'path to credentials file for Gmail API')
        .option('--token-file <path>', 'path to token file for Gmail API')
        .option('--api-scopes [apiScopes...]', 'API scopes (space-separated list of scopes) for Gmail API')

    retProgram = await cabazooka.configure(retProgram);
    retProgram.version(VERSION);
    return retProgram;
}
