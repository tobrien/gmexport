#!/usr/bin/env node
import { Command } from 'commander';
import * as Arguments from './arguments';
import { getLogger, setLogLevel } from './logging';
import * as Run from './run';
import { Config as ExportConfig } from './export.d';
import { configure, connect, exportEmails, ExitError } from './phases';
import { Instance as GmailExportInstance } from './gmailExport.d';
import { ALLOWED_FILENAME_OPTIONS, ALLOWED_OUTPUT_STRUCTURES, DEFAULT_FILENAME_OPTIONS, DEFAULT_OUTPUT_DIRECTORY, DEFAULT_OUTPUT_STRUCTURE, DEFAULT_TIMEZONE, PROGRAM_NAME, VERSION } from './constants';
import * as Cabazooka from '@tobrien/cabazooka';
import { Input } from './arguments';

export async function main() {

    // eslint-disable-next-line no-console
    console.info(`Starting ${PROGRAM_NAME}: ${VERSION}`);

    const cabazookaOptions = Cabazooka.createOptions({
        defaults: {
            timezone: DEFAULT_TIMEZONE,
            outputStructure: DEFAULT_OUTPUT_STRUCTURE,
            filenameOptions: DEFAULT_FILENAME_OPTIONS,
            outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
        },
        allowed: {
            outputStructures: ALLOWED_OUTPUT_STRUCTURES,
            filenameOptions: ALLOWED_FILENAME_OPTIONS,
        },
        features: ['output', 'structured-output'],
    });

    const cabazooka = Cabazooka.create(cabazookaOptions);

    const program = new Command();
    Arguments.configure(program, cabazooka);
    program.parse();

    const options: Input = program.opts();

    // Set log level based on verbose flag
    if (options.verbose) {
        setLogLevel('debug');
    }
    const logger = getLogger();

    try {

        const { exportConfig, runConfig }: { exportConfig: ExportConfig; runConfig: Run.Config; } = await configure(options, logger, cabazooka);
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