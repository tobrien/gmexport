#!/usr/bin/env node
import * as Arguments from './arguments';
import * as GmailApi from './gmail/api';
import * as Auth from './gmail/auth';
import * as GmailExport from './gmailExport';
import * as Run from './run';
import { Logger } from 'winston';
import { ArgumentError } from './error/ArgumentError';
import { Instance as GmailExportInstance } from './gmailExport.d';
import { Cabazooka, Operator as CabazookaOperator } from '@tobrien/cabazooka';
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

export async function connect(runConfig: Run.Config, logger: Logger, operator: CabazookaOperator): Promise<GmailExportInstance> {
    let gmail: GmailExportInstance;

    try {
        const authInstance = await Auth.create(runConfig);
        const auth = await authInstance.authorize();
        const api = GmailApi.create(auth);
        gmail = GmailExport.create(runConfig, api, operator);
    } catch (error: any) {
        logger.error('Error occurred during connection phase: %s %s', error.message, error.stack);
        throw new ExitError('Error occurred during connection phase');
    }
    return gmail;
}

export async function configure(options: Input, logger: Logger, cabazooka: Cabazooka): Promise<Run.Config> {
    let runConfig: Run.Config;
    try {
        const { start: startStr, end: endStr, ...restOptions } = options;

        const runParams: Run.InputParameters = {
            ...restOptions,
            start: startStr ? new Date(startStr) : undefined,
            end: endStr ? new Date(endStr) : undefined,
        };

        if (startStr && isNaN(runParams.start!.getTime())) {
            throw new Run.ConfigError(`Invalid start date format: ${startStr}. Please use YYYY-MM-DD.`);
        }
        if (endStr && isNaN(runParams.end!.getTime())) {
            throw new Run.ConfigError(`Invalid end date format: ${endStr}. Please use YYYY-MM-DD.`);
        }

        runConfig = await Run.createConfig(runParams);

        logger.info('\n\n\tRun Configuration: %s', JSON.stringify(runConfig, null, 2).replace(/\n/g, '\n\t') + '\n\n');
    } catch (error: any) {
        if (error instanceof ArgumentError) {
            const argumentError = error as ArgumentError;
            logger.error('There was an error with a command line argument');
            logger.error('\tcommand line argument: %s', argumentError.argument);
            logger.error('\tmessage: %s', argumentError.message);
        } else if (error instanceof Run.ConfigError) {
            logger.error('An Error occurred configuring this run of the export: %s', error.message);
        } else {
            logger.error('A general error occurred during configuration phase: %s %s', error.message, error.stack);
        }
        throw new ExitError('Error occurred during configuration phase');
    }
    return runConfig;
}
