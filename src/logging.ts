import winston from 'winston';

export interface LogContext {
    [key: string]: any;
}

const createLogger = (level: string = 'info') => {

    let format = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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
        defaultMeta: { service: 'gmail-export' },
        transports,
    });
};

let logger = createLogger();

export const setLogLevel = (level: string) => {
    logger = createLogger(level);
};

export const getLogger = () => logger; 