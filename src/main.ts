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

async function main() {
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

        console.log('\nExport Configuration:');
        console.log('---------------------');
        console.log(`Config file: ${options.config}`);
        console.log(`Output directory: ${destinationDir}`);
        console.log(`Date range: ${startDateStr} to ${endDateStr}`);
        console.log('---------------------\n');

        const config = Config.createConfig(options);

        // Print configuration details
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
        console.log('  Skip Labels:');
        if (config.filters.skip_labels.length > 0) {
            config.filters.skip_labels.forEach(label => console.log(`    - ${label}`));
        } else {
            console.log('    None');
        }
        console.log('  Skip Emails:');
        console.log('    From patterns:');
        if (config.filters.skip_emails.from.length > 0) {
            config.filters.skip_emails.from.forEach(pattern => console.log(`      - ${pattern}`));
        } else {
            console.log('      None');
        }
        console.log('    Subject patterns:');
        if (config.filters.skip_emails.subject.length > 0) {
            config.filters.skip_emails.subject.forEach(pattern => console.log(`      - ${pattern}`));
        } else {
            console.log('      None');
        }
        console.log('----------------------\n');

        const auth = await Auth.create(config).authorize();

        const gmail = Gmail.create(config, auth);
        await gmail.exportEmails();

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main(); 