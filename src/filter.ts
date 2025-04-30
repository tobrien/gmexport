import MessageWrapper from './gmail/MessageWrapper';
import { GMExportConfig } from 'types';

export const create = (config: GMExportConfig) => {

    function checkInclusiveFilters(message: MessageWrapper): { skip: boolean; reason?: string } | null {

        const from = message.from;
        const subject = message.subject;
        const to = message.to;
        const labels = message.raw.labelIds;

        // Check if any inclusive filters are defined
        if (config.filters?.include?.labels?.length || config.filters?.include?.from?.length || config.filters?.include?.to?.length || config.filters?.include?.subject?.length) {
            let matches = false;

            // Check from patterns
            if (config.filters.include.from?.length && config.filters.include.from.some((pattern: string) => new RegExp(pattern, 'i').test(from!))) {
                matches = true;
            }

            // Check subject patterns
            if (config.filters?.include?.subject?.length && config.filters?.include?.subject.some((pattern: string) => new RegExp(pattern, 'i').test(subject!))) {
                matches = true;
            }

            // Check to patterns 
            if (config.filters.include.to?.length && config.filters.include.to.some((pattern: string) => new RegExp(pattern, 'i').test(to!))) {
                matches = true;
            }

            // Check labels
            if (config.filters?.include?.labels?.length && labels?.some((label: string) => config.filters?.include?.labels?.includes(label))) {
                matches = true;
            }

            // If include filters exist but none match, skip this email
            if (!matches) {
                return { skip: true, reason: 'No include patterns matched' };
            }

            // If we matched an include pattern, keep the email regardless of exclusions
            return { skip: false };
        }
        return null;
    }

    function checkExclusiveFilters(message: MessageWrapper): { skip: boolean; reason?: string } {

        const from = message.from;
        const subject = message.subject;
        const to = message.to;
        const labels = message.raw.labelIds;

        // Check from patterns
        if (config.filters?.exclude?.from && config.filters?.exclude?.from.some((pattern: string) => new RegExp(pattern, 'i').test(from!))) {
            return { skip: true, reason: 'Skipped sender pattern' };
        }

        // Check subject patterns
        if (config.filters?.exclude?.subject && config.filters?.exclude?.subject.some((pattern: string) => new RegExp(pattern, 'i').test(subject!))) {
            return { skip: true, reason: 'Skipped subject pattern' };
        }

        // Check to patterns
        if (config.filters?.exclude?.to && config.filters?.exclude?.to.some((pattern: string) => new RegExp(pattern, 'i').test(to!))) {
            return { skip: true, reason: 'Skipped recipient pattern' };
        }

        // Check labels
        if (labels && labels.some((label: string) => config.filters?.exclude?.labels?.includes(label))) {
            return { skip: true, reason: 'Skipped label' };
        }

        return { skip: false };
    }

    // Add function to check if email should be skipped
    function shouldSkipEmail(message: MessageWrapper): { skip: boolean; reason?: string } {
        const inclusiveResult = checkInclusiveFilters(message);
        if (inclusiveResult !== null) {
            return inclusiveResult;
        }

        return checkExclusiveFilters(message);
    }

    return {
        shouldSkipEmail: shouldSkipEmail
    };
}