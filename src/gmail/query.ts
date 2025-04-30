import { getLogger } from '../logging';
import * as Dates from '../util/dates';
import { DATE_FORMAT_YEAR_MONTH_DAY_SLASH } from '../constants';
import { DateRange, GMExportConfig } from 'types';

export function createQuery(dateRange: DateRange, config: GMExportConfig, timezone: string): string {
    const dates = Dates.create({ timezone });
    const afterDate = dates.format(dateRange.start, DATE_FORMAT_YEAR_MONTH_DAY_SLASH);

    // Add one day to end date to make the range inclusive
    const adjustedEndDate = dates.addDays(dateRange.end, 1);
    const beforeDate = dates.format(adjustedEndDate, DATE_FORMAT_YEAR_MONTH_DAY_SLASH);


    // Construct Gmail search query
    let query = `after:${afterDate} before:${beforeDate}`;
    if (config.filters?.include?.labels && config.filters.include.labels.length > 0) {
        query += ` label:${config.filters.include.labels.join(' OR label:')}`;
    }
    if (config.filters?.exclude?.labels && config.filters.exclude.labels.length > 0) {
        query += ` -label:${config.filters.exclude.labels.join(' AND -label:')}`;
    }

    printGmailQueryInfo(afterDate, beforeDate, config.filters?.include?.labels || [], config.filters?.exclude?.labels || [], query);
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

