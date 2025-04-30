import { z } from 'zod';
import * as Cabazooka from '@tobrien/cabazooka';
import * as GiveMeTheConfig from '@tobrien/givemetheconfig';

export interface DateRange {
    start: Date;
    end: Date;
}

export interface JobArgs {
    currentMonth?: boolean;
    start?: string;
    end?: string;
}

export interface Args {
    dryRun?: boolean;
    verbose?: boolean;
    config?: string;
    credentialsFile?: string;
    tokenFile?: string;
    apiScopes?: string[];
}

export interface CombinedArgs extends Args, JobArgs, Cabazooka.Args, GiveMeTheConfig.Args {
}

export const MessageFilterSchema = z.object({
    labels: z.array(z.string()).optional(),
    from: z.array(z.string()).optional(),
    to: z.array(z.string()).optional(),
    subject: z.array(z.string()).optional(),
});

export const GMExportConfigSchema = z.object({
    dryRun: z.boolean(),
    verbose: z.boolean(),
    config: z.string(),
    credentialsFile: z.string(),
    tokenFile: z.string(),
    apiScopes: z.array(z.string()),
    filters: z.object({
        exclude: MessageFilterSchema.optional(),
        include: MessageFilterSchema.optional(),
    }).optional(),
});

export const JobConfigSchema = z.object({
    currentMonth: z.boolean(),
    start: z.string(),
    end: z.string(),
});

export type GMExportConfig = z.infer<typeof GMExportConfigSchema> & Cabazooka.Config & GiveMeTheConfig.Config;
export type JobConfig = z.infer<typeof JobConfigSchema>;

// Add this interface for label mapping
export interface GmailLabel {
    id: string;
    name: string;
    type: string;
}

// Type for the headers we care about
export interface MessageHeaders {
    from: string;
    to?: string;
    subject?: string;
    date: string;
    messageId?: string;
    deliveredTo?: string;
    replyTo?: string;
    contentType?: string;
    cc?: string;
    bcc?: string;
}