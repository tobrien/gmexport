#!/usr/bin/env node
import { Operator as CabazookaOperator } from '@tobrien/cabazooka';
import * as GmailApi from './gmail/api';
import * as Auth from './gmail/auth';
import * as GmailExport from './gmailExport';
import { Instance as GmailExportInstance } from './gmailExport.d';
import { getLogger } from './logging';
import { DateRange, GMExportConfig } from './types';

export class ExitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExitError';
    }
}


export async function exportEmails(gmail: GmailExportInstance, gmExportConfig: GMExportConfig, dateRange: DateRange) {
    const logger = getLogger();
    try {
        await gmail.exportEmails(dateRange);
    } catch (error: any) {
        logger.error('Error occurred during export phase: %s %s', error.message, error.stack);
        throw new ExitError('Error occurred during export phase');
    }
}

export async function connect(gmExportConfig: GMExportConfig, operator: CabazookaOperator): Promise<GmailExportInstance> {
    const logger = getLogger();
    let gmail: GmailExportInstance;

    try {
        const authInstance = await Auth.create(gmExportConfig);
        const auth = await authInstance.authorize();
        const api = GmailApi.create(auth);
        gmail = GmailExport.create(gmExportConfig, api, operator);
    } catch (error: any) {
        logger.error('Error occurred during connection phase: %s %s', error.message, error.stack);
        throw new ExitError('Error occurred during connection phase');
    }
    return gmail;
}