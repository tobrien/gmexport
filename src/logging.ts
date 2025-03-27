import winston from 'winston';
import { DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS, PROGRAM_NAME } from './constants';

export interface LogContext {
    [key: string]: any;
}

const createLogger = (level: string = 'info') => {

    let format = winston.format.combine(
        winston.format.timestamp({ format: DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    );

    let transports = [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} ${level}: ${message}${metaStr}`;
                })
            )
        })
    ];

    if (level === 'info') {
        format = winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.splat(),
        );

        transports = [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.printf(({ level, message }) => {
                        return `${level}: ${message}`;
                    })
                )
            })
        ];
    }

    return winston.createLogger({
        level,
        format,
        defaultMeta: { service: PROGRAM_NAME },
        transports,
    });
};

let logger = createLogger();

export const setLogLevel = (level: string) => {
    logger = createLogger(level);
};

export const getLogger = () => logger; 