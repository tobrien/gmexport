#!/usr/bin/env node
import { Command } from 'commander';
import dayjs from 'dayjs';
import * as Auth from './auth.js';
import * as Config from './config.js';
import * as Gmail from './gmail.js';

export interface CommandLineArgs {
    config: string;
    output: string;
    start?: string;
    end?: string;
    currentMonth?: boolean;
    dryRun: boolean;
}

export const DEFAULT_CONFIG_FILE = './config.yaml';
export const DEFAULT_OUTPUT_DIR = './exports';

// Get date 31 days ago in YYYY-MM-DD format
export const DEFAULT_START_DATE = dayjs().subtract(31, 'day').format('YYYY-MM-DD');
export const DEFAULT_END_DATE = dayjs().format('YYYY-MM-DD');

export interface DateRange {
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
}

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
        .version('1.0.0');

    program.parse();

    const options: CommandLineArgs = program.opts();
    const destinationDir = options.output;

    // Validate that --current-month is not used with other date options
    if (options.currentMonth && (options.start || options.end)) {
        console.error('Error: --current-month cannot be used together with --start or --end options');
        process.exit(1);
    }

    try {
        const dateRange = calculateDateRange(options);

        logExportConfiguration(options, destinationDir, dateRange);

        const config = Config.createConfig(options);

        // Print configuration details
        logDetailedConfiguration(config);

        const auth = await Auth.create(config).authorize();

        const gmail = Gmail.create(config, auth);
        await gmail.exportEmails(dateRange);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

export function calculateDateRange(options: CommandLineArgs): DateRange {
    let startDate: dayjs.Dayjs;
    let endDate: dayjs.Dayjs;

    if (options.currentMonth) {
        const today = dayjs();
        startDate = today.startOf('month');
        endDate = today;
    } else {

        // Handle end date
        if (options.end) {
            endDate = dayjs(options.end);
            if (!endDate.isValid()) {
                console.error('Invalid end date format. Please use YYYY-MM-DD');
                process.exit(1);
            }
        } else {
            endDate = dayjs();
        }

        // Handle start date
        if (options.start) {
            startDate = dayjs(options.start);
            if (!startDate.isValid()) {
                console.error('Invalid start date format. Please use YYYY-MM-DD');
                process.exit(1);
            }
        } else {
            startDate = endDate.subtract(31, 'day');
        }
    }

    if (endDate.isBefore(startDate)) {
        console.error('End date must be after start date');
        process.exit(1);
    }

    return {
        start: startDate,
        end: endDate
    };
}

function logExportConfiguration(options: CommandLineArgs, destinationDir: string, dateRange: DateRange) {
    console.log('\nExport Configuration:');
    console.log('---------------------');
    console.log(`Config file: ${options.config}`);
    console.log(`Output directory: ${destinationDir}`);
    console.log(`Date range: ${dateRange.start.format('YYYY-MM-DD')} to ${dateRange.end.format('YYYY-MM-DD')}`);
    console.log('---------------------\n');
}

function logDetailedConfiguration(config: Config.Config) {
    console.log('Detailed Configuration:');
    console.log('----------------------');
    console.log('Credentials:');
    console.log(`  Credentials file: ${config.credentials.credentials_file}`);
    console.log(`  Token file: ${config.credentials.token_file}`);
    console.log('\nExport Settings:');
    console.log(`  Max results: ${config.export.max_results}`);
    console.log(`  Destination: ${config.export.destination_dir}`);
    console.log('\nFilters:');
    console.log('  Include Labels:');
    if (config.filters.include?.labels?.length) {
        config.filters.include.labels.forEach(label => console.log(`    - ${label}`));
    } else {
        console.log('    None');
    }
    console.log('  Include From:');
    if (config.filters.include?.from?.length) {
        config.filters.include.from.forEach(pattern => console.log(`    - ${pattern}`));
    } else {
        console.log('    None');
    }
    console.log('  Include To:');
    if (config.filters.include?.to?.length) {
        config.filters.include.to.forEach(pattern => console.log(`    - ${pattern}`));
    } else {
        console.log('    None');
    }
    console.log('  Include Subject:');
    if (config.filters.include?.subject?.length) {
        config.filters.include.subject.forEach(pattern => console.log(`    - ${pattern}`));
    } else {
        console.log('    None');
    }
    console.log('  Skip Emails:');
    console.log('    Labels:');
    if (config.filters.exclude?.labels?.length) {
        config.filters.exclude.labels.forEach(label => console.log(`      - ${label}`));
    } else {
        console.log('      None');
    }
    console.log('    To patterns:');
    if (config.filters.exclude?.to?.length) {
        config.filters.exclude.to.forEach(pattern => console.log(`      - ${pattern}`));
    } else {
        console.log('      None');
    }
    console.log('    From patterns:');
    if (config.filters.exclude?.from?.length) {
        config.filters.exclude.from.forEach(pattern => console.log(`      - ${pattern}`));
    } else {
        console.log('      None');
    }
    console.log('    Subject patterns:');
    if (config.filters.exclude?.subject?.length) {
        config.filters.exclude.subject.forEach(pattern => console.log(`      - ${pattern}`));
    } else {
        console.log('      None');
    }
    console.log('----------------------\n');
}

main(); 