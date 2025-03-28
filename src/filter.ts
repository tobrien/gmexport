import { Config } from "./config.js";
import { Email } from "./gmail.js";
import { getLogger } from './logging.js';

export const create = (config: Config) => {
    const logger = getLogger();

    function checkInclusiveFilters(email: Email): { skip: boolean; reason?: string } | null {
        // Check if any inclusive filters are defined
        if (config.filters.include.labels?.length || config.filters.include.from?.length || config.filters.include.to?.length || config.filters.include.subject?.length) {
            let matches = false;

            // Check from patterns
            if (config.filters.include.from?.length && config.filters.include.from.some((pattern: string) => new RegExp(pattern, 'i').test(email.from))) {
                matches = true;
            }

            // Check subject patterns
            if (config.filters.include.subject?.length && config.filters.include.subject.some((pattern: string) => new RegExp(pattern, 'i').test(email.subject))) {
                matches = true;
            }

            // Check to patterns 
            if (config.filters.include.to?.length && config.filters.include.to.some((pattern: string) => new RegExp(pattern, 'i').test(email.to))) {
                matches = true;
            }

            // Check labels
            if (config.filters.include.labels?.length && email.labels?.some((label: string) => config.filters.include.labels?.includes(label))) {
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

    function checkExclusiveFilters(email: Email): { skip: boolean; reason?: string } {
        // Check from patterns
        if (config.filters.exclude.from && config.filters.exclude.from.some((pattern: string) => new RegExp(pattern, 'i').test(email.from))) {
            return { skip: true, reason: 'Skipped sender pattern' };
        }

        // Check subject patterns
        if (config.filters.exclude.subject && config.filters.exclude.subject.some((pattern: string) => new RegExp(pattern, 'i').test(email.subject))) {
            return { skip: true, reason: 'Skipped subject pattern' };
        }

        // Check to patterns
        if (config.filters.exclude.to && config.filters.exclude.to.some((pattern: string) => new RegExp(pattern, 'i').test(email.to))) {
            return { skip: true, reason: 'Skipped recipient pattern' };
        }

        // Check labels
        if (email.labels && email.labels.some((label: string) => config.filters.exclude.labels?.includes(label))) {
            return { skip: true, reason: 'Skipped label' };
        }

        return { skip: false };
    }

    // Add function to check if email should be skipped
    function shouldSkipEmail(email: Email): { skip: boolean; reason?: string } {
        const inclusiveResult = checkInclusiveFilters(email);
        if (inclusiveResult !== null) {
            return inclusiveResult;
        }

        return checkExclusiveFilters(email);
    }

    return {
        shouldSkipEmail: shouldSkipEmail
    };
}