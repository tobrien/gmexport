import dayjs from 'dayjs';
import { getLogger } from '../logging.js';
import { Configuration, DateRange } from '../types.js';


export function formatDateForGmailQuery(date: Date): string {
    return dayjs(date).format('YYYY/MM/DD');
}
export function createQuery(dateRange: DateRange, config: Configuration): string {
    const afterDate = formatDateForGmailQuery(dateRange.start);
    // Add one day to end date to make the range inclusive
    const adjustedEndDate = dayjs(dateRange.end).add(1, 'day');
    const beforeDate = formatDateForGmailQuery(adjustedEndDate.toDate());

    // Construct Gmail search query
    let query = `after:${afterDate} before:${beforeDate}`;
    if (config.filters.include.labels && config.filters.include.labels.length > 0) {
        query += ` label:${config.filters.include.labels.join(' OR label:')}`;
    }
    if (config.filters.exclude.labels && config.filters.exclude.labels.length > 0) {
        query += ` -label:${config.filters.exclude.labels.join(' AND -label:')}`;
    }

    printGmailQueryInfo(afterDate, beforeDate, config.filters.include.labels || [], config.filters.exclude.labels || [], query);
    return query;
}

export function printGmailQueryInfo(afterDate: string, beforeDate: string, includeLabels: string[], excludeLabels: string[], query: string) {
    const logger = getLogger();

    logger.info('Gmail search parameters:');
    logger.info(`\tDate range: ${afterDate} to ${beforeDate}`);
    logger.info(`\tInclude labels: ${includeLabels.join(', ') || 'none'}`);
    logger.info(`\tExclude labels: ${excludeLabels.join(', ') || 'none'}`);
    logger.info(`\tFull query: ${query}`);
}

