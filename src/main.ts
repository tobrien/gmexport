#!/usr/bin/env node
import { Command } from 'commander';
import dayjs from 'dayjs';
import * as Config from './config.js';
import * as GmailExport from './gmailExport.js';
import * as GmailApi from './gmail/api.js';
import * as Auth from './gmail/auth.js';
import { getLogger, setLogLevel } from './logging.js';
import { CommandLineArgs, Configuration, DateRange } from './types.js';

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
        .option('-c, --config <path>', 'Path to configuration file', DEFAULT_CONFIG_FILE)
        .option('-o, --output <path>', 'destination directory for exported emails', DEFAULT_OUTPUT_DIR)
        .option('-s, --start <date>', 'start date (YYYY-MM-DD). If omitted, defaults to 31 days before end date')
        .option('-e, --end <date>', 'end date (YYYY-MM-DD). If omitted, defaults to current date')
        .option('--current-month', 'export emails from the first day of the current month to today')
        .option('--dry-run', 'perform a dry run without saving files', false)
        .option('-v, --verbose', 'enable debug logging', false)
        .version('1.0.0');

    program.parse();

    const options: CommandLineArgs = program.opts();
    const destinationDir = options.output;

    // Set log level based on verbose flag
    if (options.verbose) {
        setLogLevel('debug');
    }

    const logger = getLogger();

    // Validate that --current-month is not used with other date options
    if (options.currentMonth && (options.start || options.end)) {
        logger.error('--current-month cannot be used together with --start or --end options');
        process.exit(1);
    }

    try {
        const dateRange = calculateDateRange(options);

        logExportConfiguration(options, destinationDir, dateRange);

        const config = Config.createConfiguration(options);

        // Print configuration details
        logDetailedConfiguration(config);

        const auth = await Auth.create(config).authorize();
        const api = await GmailApi.create(auth);
        const gmail = GmailExport.create(config, api);
        await gmail.exportEmails(dateRange);

    } catch (error) {
        logger.error('Error occurred during export:', { error });
        process.exit(1);
    }
}

export function calculateDateRange(options: CommandLineArgs): DateRange {
    let startDate: dayjs.Dayjs;
    let endDate: dayjs.Dayjs;
    const logger = getLogger();

    if (options.currentMonth) {
        const today = dayjs();
        startDate = today.startOf('month');
        endDate = today;
    } else {
        // Handle end date
        if (options.end) {
            endDate = dayjs(options.end);
            if (!endDate.isValid()) {
                logger.error('Invalid end date format. Please use YYYY-MM-DD');
                process.exit(1);
            }
        } else {
            endDate = dayjs();
        }

        // Handle start date
        if (options.start) {
            startDate = dayjs(options.start);
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

export function logExportConfiguration(options: CommandLineArgs, destinationDir: string, dateRange: DateRange) {
    const logger = getLogger();
    logger.info('Export Configuration:');
    logger.info(`\tConfig File: ${options.config}`);
    logger.info('\tDate Range:');
    logger.info(`\t\tStart: ${dayjs(dateRange.start).format('YYYY-MM-DD')}`);
    logger.info(`\t\tEnd: ${dayjs(dateRange.end).format('YYYY-MM-DD')}`);
}

export function logDetailedConfiguration(config: Configuration) {
    const logger = getLogger();
    logger.info('Detailed Configuration:');
    logger.info('\tCredentials:');
    logger.info(`\t\tCredentials File: ${config.credentials.credentials_file}`);
    logger.info(`\t\tToken File: ${config.credentials.token_file}`);
    logger.info('\tExport Settings:');
    logger.info(`\t\tMax Results: ${config.export.max_results}`);
    logger.info(`\t\tDestination: ${config.export.destination_dir}`);
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