#!/usr/bin/env node
import { Command } from 'commander';
import * as Arguments from './arguments';
import { getLogger, setLogLevel } from './logging';
import * as Run from './run';
import { Config as ExportConfig } from './export.d';
import { configure, connect, exportEmails, ExitError } from './phases';
import { Input as ArgumentsInput } from './arguments.d';
import { Instance as GmailExportInstance } from './gmailExport.d';

export async function main() {
    const program = new Command();
    Arguments.configure(program);
    program.parse();

    const options: ArgumentsInput = program.opts();

    // Set log level based on verbose flag
    if (options.verbose) {
        setLogLevel('debug');
    }
    const logger = getLogger();

    try {

        const { exportConfig, runConfig }: { exportConfig: ExportConfig; runConfig: Run.Config; } = await configure(options, logger);
        const gmail: GmailExportInstance = await connect(exportConfig, runConfig, logger);
        await exportEmails(gmail, runConfig, logger);

    } catch (error: any) {
        if (error instanceof ExitError) {
            logger.error('Exiting due to Error');
        } else {
            logger.error('Exiting due to Error: %s', error.message);
        }
        process.exit(1);
    }
}

main();