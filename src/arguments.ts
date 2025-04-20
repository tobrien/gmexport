import { Command } from "commander";
import { ALLOWED_FILENAME_OPTIONS, ALLOWED_OUTPUT_STRUCTURES, ALLOWED_SCOPES, DEFAULT_CURRENT_MONTH, DEFAULT_DRY_RUN, DEFAULT_VERBOSE, PROGRAM_NAME, VERSION } from "./constants";
import { ArgumentError } from "./error/ArgumentError";
import * as Export from "./export";
import { Config as ExportConfig } from "./export.d";
import { getLogger } from "./logging";
import * as Run from "./run";
import * as Dates from "./util/dates";
import * as Storage from "./util/storage";
import { Cabazooka, Input as CabazookaInput } from "@tobrien/cabazooka";
import { FilenameOption, OutputStructure } from "@tobrien/cabazooka";

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

export const generateConfig = async (input: Input, cabazooka: Cabazooka): Promise<[Run.Config, ExportConfig]> => {


    const cabazookaRunConfig = await cabazooka.validate(input);

    // Validate start date format if provided
    if (input.start && !/^\d{4}-\d{2}-\d{2}$/.test(input.start)) {
        throw new ArgumentError('--start', 'must be in YYYY-MM-DD format');
    }

    // Validate end date format if provided
    if (input.end && !/^\d{4}-\d{2}-\d{2}$/.test(input.end)) {
        throw new ArgumentError('--end', 'must be in YYYY-MM-DD format');
    }

    // Validate that --current-month is not used with other date options
    if (input.currentMonth && (input.start || input.end)) {
        throw new ArgumentError('--current-month', 'cannot be used together with either --start or --end options');
    }

    // Validate the config exists, if you supplied it
    await validateConfig(input.config);

    // Validate credentials file
    await validateCredentialsFile(input.credentialsFile);

    // Validate token file
    await validateTokenFile(input.tokenFile);

    // Validate API scopes
    validateApiScopes(input.apiScopes);

    // Create date parser
    const dates = Dates.create({ timezone: cabazookaRunConfig.timezone });
    const startDate: Date | undefined = input.start ? dates.parse(input.start, 'YYYY-MM-DD') : undefined;
    const endDate: Date | undefined = input.end ? dates.parse(input.end, 'YYYY-MM-DD') : undefined;

    // Create the run configuration
    const runConfig = Run.createConfig({
        start: startDate,
        end: endDate,
        currentMonth: input.currentMonth,
        dryRun: input.dryRun,
        verbose: input.verbose,
        timezone: cabazookaRunConfig.timezone,
    });

    // Create the export configuration
    const exportConfig = await Export.createConfig({
        outputStructure: cabazookaRunConfig.outputStructure as OutputStructure,
        filenameOptions: cabazookaRunConfig.filenameOptions as FilenameOption[],
        outputDirectory: cabazookaRunConfig.outputDirectory,
        credentialsFile: input.credentialsFile,
        tokenFile: input.tokenFile,
        apiScopes: input.apiScopes,
    });

    return [runConfig, exportConfig];
}

export const validateApiScopes = (apiScopes: string[] | undefined): void => {
    if (apiScopes) {
        if (apiScopes.length === 0) {
            throw new ArgumentError('--api-scopes', 'API scopes cannot be empty');
        }
        for (const scope of apiScopes) {
            if (!ALLOWED_SCOPES.includes(scope)) {
                throw new ArgumentError('--api-scopes', `Invalid API scope: ${scope}. Valid scopes are: ${ALLOWED_SCOPES.join(', ')}`);
            }
        }
    }
}
export const validateTokenFile = async (tokenFile: string | undefined): Promise<void> => {
    const storage = Storage.create({ log: getLogger().debug });
    if (tokenFile) {
        if (!await storage.exists(tokenFile)) {
            throw new ArgumentError('--token-file', `Token file ${tokenFile} does not exist`);
        }
        if (!await storage.isFileReadable(tokenFile)) {
            throw new ArgumentError('--token-file', `Token file ${tokenFile} is not readable`);
        }
    }
}

export const validateCredentialsFile = async (credentialsFile: string | undefined): Promise<void> => {
    const storage = Storage.create({ log: getLogger().debug });
    if (credentialsFile) {
        if (!await storage.exists(credentialsFile)) {
            throw new ArgumentError('--credentials-file', `Credentials file ${credentialsFile} does not exist`);
        }
        if (!await storage.isFileReadable(credentialsFile)) {
            throw new ArgumentError('--credentials-file', `Credentials file ${credentialsFile} is not readable`);
        }
    }
}

export const validateConfig = async (config: string | undefined): Promise<void> => {
    const storage = Storage.create({ log: getLogger().debug });
    if (config) {
        if (!await storage.exists(config)) {
            throw new ArgumentError('--config', `Configuration file ${config} does not exist`);
        }
        if (!await storage.isFileReadable(config)) {
            throw new ArgumentError('--config', `Configuration file ${config} is not readable`);
        }
    }
}


export const validateOutputDirectory = async (optionsValue: string): Promise<void> => {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.debug });

    // Verify output directory exists and is writable
    if (optionsValue) {
        if (!await storage.isDirectoryWritable(optionsValue)) {
            logger.warn(`Output directory ${optionsValue} does not exist, or it not writable, creating it`);
            try {
                await storage.createDirectory(optionsValue);
            } catch (error: any) {
                throw new ArgumentError('--output-directory', `Failed to create output directory ${optionsValue}: ${error.message} ${error.stack}`);
            }
            if (!await storage.isDirectoryWritable(optionsValue)) {
                throw new ArgumentError('--output-directory', `Output directory ${optionsValue} created but is not writable`);
            }
        }
    }
}

export const validateTimezone = (timezone: string): string => {
    const validOptions = Dates.validTimezones();
    if (validOptions.includes(timezone)) {
        return timezone;
    }
    throw new ArgumentError('--timezone', `Invalid timezone: ${timezone}. Valid options are: ${validOptions.join(', ')}`);
}

export const validateOutputStructure = (outputStructure: string | undefined): void => {
    const validOptions = ALLOWED_OUTPUT_STRUCTURES;
    if (outputStructure && !validOptions.includes(outputStructure as OutputStructure)) {
        throw new ArgumentError('--output-structure', `Invalid output structure: ${outputStructure}. Valid options are: ${validOptions.join(', ')}`);
    }
}

export const validateFilenameOptions = (filenameOptions: string[] | undefined, outputStructure: OutputStructure | undefined): void => {
    if (filenameOptions) {
        // Check if first argument contains commas - likely a comma-separated list
        if (filenameOptions[0].includes(',')) {
            throw new ArgumentError('--filename-options', 'Filename options should be space-separated, not comma-separated. Example: --filename-options date time subject');
        }

        // Check if first argument looks like a quoted string containing multiple options
        if (filenameOptions.length === 1 && filenameOptions[0].split(' ').length > 1) {
            throw new ArgumentError('--filename-options', 'Filename options should not be quoted. Use: --filename-options date time subject instead of --filename-options "date time subject"');
        }
        const validOptions = ALLOWED_FILENAME_OPTIONS;
        const invalidOptions = filenameOptions.filter(opt => !validOptions.includes(opt as FilenameOption));
        if (invalidOptions.length > 0) {
            throw new ArgumentError('--filename-options', `Invalid filename options: ${invalidOptions.join(', ')}. Valid options are: ${validOptions.join(', ')}`);
        }

        // Validate date option against output structure
        if (filenameOptions.includes('date')) {
            if (outputStructure && outputStructure === 'day') {
                throw new ArgumentError('--filename-options', 'Cannot use date in filename when output structure is "day"');
            }
        }
    }
}
