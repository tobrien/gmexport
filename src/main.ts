#!/usr/bin/env node
import { Command } from 'commander';
import * as Arguments from './arguments.js';
import * as GmailApi from './gmail/api.js';
import * as Auth from './gmail/auth.js';
import * as GmailExport from './gmailExport.js';
import { getLogger, setLogLevel } from './logging.js';
import * as Run from './run.js';
import * as Export from './export.js';
import { Logger } from 'winston';
import { Config as ExportConfig } from './export.d.js';
export async function main() {
    const program = new Command();
    Arguments.configure(program);
    program.parse();

    const options: Arguments.Input = program.opts();

    // Set log level based on verbose flag
    if (options.verbose) {
        setLogLevel('debug');
    }
    const logger = getLogger();
    const { exportConfig, runConfig }: { exportConfig: ExportConfig; runConfig: Run.Config; } = await configure(options, logger);
    const gmail: GmailExport.Instance = await connect(exportConfig, runConfig, logger);

    await exportEmails(gmail, runConfig, logger);
}

main();

export async function exportEmails(gmail: GmailExport.Instance, runConfig: Run.Config, logger: Logger) {
    try {
        await gmail.exportEmails(runConfig.dateRange);
    } catch (error: any) {
        logger.error('Error occurred during export phase: %s %s', error.message, error.stack);
        process.exit(1);
    }
}

export async function connect(exportConfig: ExportConfig, runConfig: Run.Config, logger: Logger) {
    let gmail: GmailExport.Instance;

    try {
        const authInstance = await Auth.create(exportConfig);
        const auth = await authInstance.authorize();
        const api = GmailApi.create(auth);
        gmail = GmailExport.create(runConfig, exportConfig, api);
    } catch (error: any) {
        logger.error('Error occurred during connection phase: %s %s', error.message, error.stack);
        process.exit(1);
    }
    return gmail;
}

export async function configure(options: Arguments.Input, logger: Logger) {
    let runConfig: Run.Config;
    let exportConfig: ExportConfig;
    try {
        [runConfig, exportConfig] = await Arguments.generateConfig(options);
        logger.info('\n\n\tRun Configuration: %s', JSON.stringify(runConfig, null, 2).replace(/\n/g, '\n\t') + '\n\n');
        logger.info('\n\n\tExport Configuration: %s', JSON.stringify(exportConfig, null, 2).replace(/\n/g, '\n\t') + '\n\n');
    } catch (error: any) {
        if (error instanceof Arguments.ArgumentError) {
            const argumentError = error as Arguments.ArgumentError;
            logger.error('There was an error with a command line argument');
            logger.error('\tcommand line argument: %s', argumentError.argument);
            logger.error('\tmessage: %s', argumentError.message);
        } else if (error instanceof Run.ConfigError) {
            logger.error('A Error occurred configuring this run of the export: %s', error.message);
        } else if (error instanceof Export.ConfigError) {
            logger.error('A Error occurred in generating the export configuration: %s', error.message);
        } else {
            logger.error('A general error occurred during configuration phase: %s %s', error.message, error.stack);
        }
        process.exit(1);
    }
    return { exportConfig, runConfig };
}
