#!/usr/bin/env node
import * as Cabazooka from '@tobrien/cabazooka';
import { Command } from 'commander';
import * as Arguments from './arguments';
import { Input } from './arguments';
import { ALLOWED_OUTPUT_FILENAME_OPTIONS, ALLOWED_OUTPUT_STRUCTURES, DEFAULT_OUTPUT_DIRECTORY, DEFAULT_OUTPUT_FILENAME_OPTIONS, DEFAULT_OUTPUT_STRUCTURE, DEFAULT_TIMEZONE, PROGRAM_NAME, VERSION } from './constants';
import { Instance as GmailExportInstance } from './gmailExport.d';
import { getLogger, setLogLevel } from './logging';
import { configure, connect, ExitError, exportEmails } from './phases';
import * as Run from './run';

export async function main() {

    // eslint-disable-next-line no-console
    console.info(`Starting ${PROGRAM_NAME}: ${VERSION}`);

    const cabazookaOptions = Cabazooka.createOptions({
        defaults: {
            timezone: DEFAULT_TIMEZONE,
            outputStructure: DEFAULT_OUTPUT_STRUCTURE,
            outputFilenameOptions: DEFAULT_OUTPUT_FILENAME_OPTIONS,
            outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
        },
        allowed: {
            outputStructures: ALLOWED_OUTPUT_STRUCTURES,
            outputFilenameOptions: ALLOWED_OUTPUT_FILENAME_OPTIONS,
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
        const runConfig: Run.Config = await configure(options, logger, cabazooka);
        // Create config needed for the operator
        const operatorConfig: Cabazooka.Config = {
            outputDirectory: runConfig.outputDirectory,
            outputStructure: runConfig.outputStructure,
            outputFilenameOptions: runConfig.outputFilenameOptions,
            timezone: runConfig.timezone,
            recursive: false, // Placeholder/default
            inputDirectory: '', // Placeholder/default
            extensions: ['.eml'], // Placeholder/default - assuming EML extension
        };
        const operator = await cabazooka.operate(operatorConfig); // Create the operator
        const gmail: GmailExportInstance = await connect(runConfig, logger, operator); // Pass operator to connect
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