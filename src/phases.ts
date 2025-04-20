#!/usr/bin/env node
import * as Arguments from './arguments';
import * as GmailApi from './gmail/api';
import * as Auth from './gmail/auth';
import * as GmailExport from './gmailExport';
import * as Run from './run';
import * as Export from './export';
import { Logger } from 'winston';
import { Config as ExportConfig } from './export.d';
import { ArgumentError } from './error/ArgumentError';
import { Instance as GmailExportInstance } from './gmailExport.d';
import { Cabazooka } from '@tobrien/cabazooka';
import { Input } from './arguments';

export class ExitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExitError';
    }
}


export async function exportEmails(gmail: GmailExportInstance, runConfig: Run.Config, logger: Logger) {
    try {
        await gmail.exportEmails(runConfig.dateRange);
    } catch (error: any) {
        logger.error('Error occurred during export phase: %s %s', error.message, error.stack);
        throw new ExitError('Error occurred during export phase');
    }
}

export async function connect(exportConfig: ExportConfig, runConfig: Run.Config, logger: Logger): Promise<GmailExportInstance> {
    let gmail: GmailExportInstance;

    try {
        const authInstance = await Auth.create(exportConfig);
        const auth = await authInstance.authorize();
        const api = GmailApi.create(auth);
        gmail = GmailExport.create(runConfig, exportConfig, api);
    } catch (error: any) {
        logger.error('Error occurred during connection phase: %s %s', error.message, error.stack);
        throw new ExitError('Error occurred during connection phase');
    }
    return gmail;
}

export async function configure(options: Input, logger: Logger, cabazooka: Cabazooka): Promise<{ exportConfig: ExportConfig; runConfig: Run.Config; }> {
    let runConfig: Run.Config;
    let exportConfig: ExportConfig;
    try {
        [runConfig, exportConfig] = await Arguments.generateConfig(options, cabazooka);
        logger.info('\n\n\tRun Configuration: %s', JSON.stringify(runConfig, null, 2).replace(/\n/g, '\n\t') + '\n\n');
        logger.info('\n\n\tExport Configuration: %s', JSON.stringify(exportConfig, null, 2).replace(/\n/g, '\n\t') + '\n\n');
    } catch (error: any) {
        if (error instanceof ArgumentError) {
            const argumentError = error as ArgumentError;
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
        throw new ExitError('Error occurred during configuration phase');
    }
    return { exportConfig, runConfig };
}
