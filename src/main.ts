#!/usr/bin/env node
import { Command } from 'commander';
import dayjs from 'dayjs';
import * as Config from './config.js';
import * as GmailExport from './gmailExport.js';
import * as GmailApi from './gmail/api.js';
import * as Auth from './gmail/auth.js';
import { getLogger, setLogLevel } from './logging.js';
import { CommandLineArgs, Configuration, DateRange } from './types.js';
import * as fs from 'fs';
import { Logger } from 'winston';

export const DEFAULT_CONFIG_FILE = './config.yaml';
export const DEFAULT_OUTPUT_DIR = './exports';

// Get date 31 days ago in YYYY-MM-DD format
export const DEFAULT_START_DATE = dayjs().subtract(31, 'day').format('YYYY-MM-DD');
export const DEFAULT_END_DATE = dayjs().format('YYYY-MM-DD');

export async function main() {
    const program = new Command();

    program
        .name('gmail-export')
        .description('Export Gmail messages within a date range to local files')
        .option('-c, --config <path>', 'Path to configuration file')
        .option('-o, --output <path>', 'destination directory for exported emails')
        .option('-s, --start <date>', 'start date (YYYY-MM-DD). If omitted, defaults to 31 days before end date')
        .option('-e, --end <date>', 'end date (YYYY-MM-DD). If omitted, defaults to current date')
        .option('--current-month', 'export emails from the first day of the current month to today')
        .option('--dry-run', 'perform a dry run without saving files', false)
        .option('-v, --verbose', 'enable debug logging', false)
        .option('--output-structure <type>', 'output directory structure (year/month/day)', 'month')
        .option('--filename-options <options>', 'filename format options (comma-separated list of: date,time,subject)', 'day,subject')
        .version('1.0.0');

    program.parse();

    const options: CommandLineArgs = program.opts();
    const destinationDir = options.output;

    // Set log level based on verbose flag
    if (options.verbose) {
        setLogLevel('debug');
    }

    const logger = getLogger();

    // Validate filename options if provided
    if (options.filenameOptions && Array.isArray(options.filenameOptions)) {
        const validOptions = ['date', 'time', 'subject'];
        const invalidOptions = options.filenameOptions.filter(opt => !validOptions.includes(opt));
        if (invalidOptions.length > 0) {
            logger.error('Invalid filename options: %s. Valid options are: %s', invalidOptions.join(', '), validOptions.join(', '));
            process.exit(1);
        }

        // Validate date option against output structure
        if (options.filenameOptions.includes('date')) {
            if (options.outputStructure === 'day') {
                logger.error('Cannot use date in filename when output structure is "day"');
                process.exit(1);
            }
        }
    }

    // Validate that --current-month is not used with other date options
    if (options.currentMonth && (options.start || options.end)) {
        logger.error('--current-month cannot be used together with --start or --end options');
        process.exit(1);
    }

    // Verify config file exists and is readable if specified
    if (options.config) {
        try {
            await fs.promises.access(options.config, fs.constants.R_OK);
        } catch (error: any) {
            logger.error(`Config file ${options.config} does not exist or is not readable: %s %s`, error.message, error.stack);
            process.exit(1);
        }
    }

    // Verify output directory exists and is writable
    if (destinationDir) {
        try {
            const stats = await fs.promises.stat(destinationDir);
            if (!stats.isDirectory()) {
                logger.error(`Output path ${destinationDir} exists but is not a directory`);
                process.exit(1);
            }
            await fs.promises.access(destinationDir, fs.constants.W_OK);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                try {
                    await fs.promises.mkdir(destinationDir, { recursive: true });
                    logger.info(`Created output directory ${destinationDir}`);
                } catch (mkdirError: any) {
                    logger.error(`Failed to create output directory ${destinationDir}: %s %s`, mkdirError.message, mkdirError.stack);
                    process.exit(1);
                }
            } else {
                logger.error(`Output directory ${destinationDir} is not writable: %s %s`, error.message, error.stack);
                process.exit(1);
            }
        }
    }

    try {
        const dateRange = calculateDateRange(options);

        logExportConfiguration(options, dateRange, logger);

        const config = Config.createConfiguration(options);

        // Print configuration details
        logDetailedConfiguration(config, logger);

        const auth = await Auth.create(config).authorize();
        const api = await GmailApi.create(auth);
        const gmail = GmailExport.create(config, api);
        await gmail.exportEmails(dateRange);

    } catch (error: any) {
        logger.error('Error occurred during export: %s %s', error.message, error.stack);
        process.exit(1);
    }
}

export function calculateDateRange(options: CommandLineArgs): DateRange {
    let startDate: dayjs.Dayjs;
    let endDate: dayjs.Dayjs;
    const logger = getLogger();

    if (options.currentMonth) {
        const today = dayjs.utc();
        startDate = today.startOf('month');
        endDate = today;
    } else {
        // Handle end date
        if (options.end) {
            endDate = dayjs.utc(options.end);
            if (!endDate.isValid()) {
                logger.error('Invalid end date format. Please use YYYY-MM-DD');
                process.exit(1);
            }
        } else {
            endDate = dayjs.utc();
        }

        // Handle start date
        if (options.start) {
            startDate = dayjs.utc(options.start);
            if (!startDate.isValid()) {
                logger.error('Invalid start date format. Please use YYYY-MM-DD');
                process.exit(1);
            }
        } else {
            startDate = endDate.subtract(31, 'day');
        }
    }

    if (endDate.isBefore(startDate)) {
        logger.error('End date must be after start date');
        process.exit(1);
    }

    return {
        start: startDate.toDate(),
        end: endDate.toDate()
    };
}

export function logExportConfiguration(options: CommandLineArgs, dateRange: DateRange, logger: Logger) {
    logger.info('Export Configuration:');
    logger.info(`\tConfig File: ${options.config}`);
    logger.info('\tDate Range:');
    logger.info(`\t\tStart: ${dayjs(dateRange.start).format('YYYY-MM-DD')}`);
    logger.info(`\t\tEnd: ${dayjs(dateRange.end).format('YYYY-MM-DD')}`);
}

export function logDetailedConfiguration(config: Configuration, logger: Logger) {
    logger.info('Detailed Configuration:');
    logger.info('\tCredentials:');
    logger.info(`\t\tCredentials File: ${config.credentials.credentials_file}`);
    logger.info(`\t\tToken File: ${config.credentials.token_file}`);
    logger.info('\tExport Settings:');
    logger.info(`\t\tMax Results: ${config.export.max_results}`);
    logger.info(`\t\tDestination: ${config.export.destination_dir}`);
    logger.info(`\t\tOutput Structure: ${config.export.output_structure}`);
    logger.info(`\t\tFilename Options: ${config.export.filename_options?.join(', ') || 'none'}`);
    logger.info('\tFilters:');
    logger.info('\t\tInclude:');
    logger.info(`\t\t\tLabels: ${config.filters.include?.labels?.join(', ') || 'none'}`);
    logger.info(`\t\t\tFrom: ${config.filters.include?.from?.join(', ') || 'none'}`);
    logger.info(`\t\t\tTo: ${config.filters.include?.to?.join(', ') || 'none'}`);
    logger.info(`\t\t\tSubject: ${config.filters.include?.subject?.join(', ') || 'none'}`);
    logger.info('\t\tExclude:');
    logger.info(`\t\t\tLabels: ${config.filters.exclude?.labels?.join(', ') || 'none'}`);
    logger.info(`\t\t\tFrom: ${config.filters.exclude?.from?.join(', ') || 'none'}`);
    logger.info(`\t\t\tTo: ${config.filters.exclude?.to?.join(', ') || 'none'}`);
    logger.info(`\t\t\tSubject: ${config.filters.exclude?.subject?.join(', ') || 'none'}`);
}

main(); 