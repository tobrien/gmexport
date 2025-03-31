import * as Dates from "./util/dates.js";

export interface DateRange {
    start: Date;
    end: Date;
}

export interface Config {
    dateRange: DateRange;
    dryRun: boolean;
    verbose: boolean;
    timezone: string;
}

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'Run.ConfigError';
    }
}

export const createConfig = (params: {
    timezone: string;
    start?: Date;
    end?: Date;
    currentMonth: boolean;
    dryRun: boolean;
    verbose: boolean;
}): Config => {
    const dateRange = createDateRange({
        timezone: params.timezone,
        currentMonth: params.currentMonth,
        start: params.start,
        end: params.end,
    });

    return {
        dateRange,
        dryRun: params.dryRun,
        verbose: params.verbose,
        timezone: params.timezone,
    }
}

function createDateRange({ timezone, currentMonth, start, end }: { timezone: string, currentMonth: boolean, start?: Date, end?: Date }): DateRange {
    let startDate: Date;
    let endDate: Date;

    const dateUtility = Dates.create({ timezone });


    if (currentMonth) {
        const today = dateUtility.now();
        startDate = dateUtility.startOfMonth(today);
        endDate = today;
    } else {
        // Handle end date
        if (end) {
            endDate = dateUtility.date(end);
        } else {
            endDate = dateUtility.now();
        }

        // Handle start date
        if (start) {
            startDate = dateUtility.date(start);
        } else {
            startDate = dateUtility.subDays(endDate, 31);
        }
    }

    if (dateUtility.isBefore(endDate, startDate)) {
        throw new ConfigError(`End date must be after start date. Start date: ${startDate.toISOString()}, End date: ${endDate.toISOString()}`);
    }

    return {
        start: startDate,
        end: endDate
    };
}