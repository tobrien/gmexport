#!/usr/bin/env node
import { Command } from 'commander';
import * as Auth from './auth.js';
import * as Config from './config.js';
import * as Gmail from './gmail.js';

export interface CommandLineArgs {
    config: string;
    output: string;
    start: string;
    end: string;
    dryRun: boolean;
}

export async function main() {
    const program = new Command();

    program
        .name('gmail-export')
        .description('Export Gmail messages within a date range to local files')
        .option('-c, --config <path>', 'Path to configuration file', Config.DEFAULT_CONFIG_FILE)
        .option('-o, --output <path>', 'destination directory for exported emails', Config.DEFAULT_DESTINATION_DIR)
        .requiredOption('-s, --start <date>', 'start date (YYYY-MM-DD)')
        .requiredOption('-e, --end <date>', 'end date (YYYY-MM-DD)')
        .option('--dry-run', 'perform a dry run without saving files', false)
        .version('1.0.0');

    program.parse();

    const options: CommandLineArgs = program.opts();
    const destinationDir = options.output;
    const startDateStr = options.start;
    const endDateStr = options.end;

    try {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error('Invalid date format. Please use YYYY-MM-DD');
            process.exit(1);
        }

        if (endDate < startDate) {
            console.error('End date must be after start date');
            process.exit(1);
        }

        logExportConfiguration(options, destinationDir, startDateStr, endDateStr);

        const config = Config.createConfig(options);

        // Print configuration details
        logDetailedConfiguration(config);

        const auth = await Auth.create(config).authorize();

        const gmail = Gmail.create(config, auth);
        await gmail.exportEmails();

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

function logExportConfiguration(options: CommandLineArgs, destinationDir: string, startDateStr: string, endDateStr: string) {
    console.log('\nExport Configuration:');
    console.log('---------------------');
    console.log(`Config file: ${options.config}`);
    console.log(`Output directory: ${destinationDir}`);
    console.log(`Date range: ${startDateStr} to ${endDateStr}`);
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
    console.log(`  Date range: ${config.export.start_date} to ${config.export.end_date}`);
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