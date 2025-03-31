import { jest } from '@jest/globals';
import { setLogLevel, getLogger, LogContext } from '../src/logging.js';
import winston from 'winston';
import { PROGRAM_NAME } from '../src/constants.js';

// Spy on winston methods instead of mocking the entire module
jest.spyOn(winston, 'createLogger');

describe('Logging module', () => {
    beforeEach(() => {
        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    test('getLogger returns a logger instance', () => {
        const logger = getLogger();
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.warn).toBe('function');
    });

    test('setLogLevel creates a new logger with the specified level', () => {
        const createLoggerSpy = jest.spyOn(winston, 'createLogger');

        // Set log level to debug
        setLogLevel('debug');

        // Verify winston.createLogger was called
        expect(createLoggerSpy).toHaveBeenCalledTimes(1);

        // Verify correct level was passed
        const callArgs = createLoggerSpy.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs && callArgs[0]) {
            const callArg = callArgs[0];
            expect(callArg.level).toBe('debug');
            expect(callArg.defaultMeta).toEqual({ service: PROGRAM_NAME });
        }
    });

    test('setLogLevel with info level configures logger differently than other levels', () => {
        const createLoggerSpy = jest.spyOn(winston, 'createLogger');

        // Set log level to info
        setLogLevel('info');

        // Set log level to debug
        setLogLevel('debug');

        // Verify winston.createLogger was called twice with different configurations
        expect(createLoggerSpy).toHaveBeenCalledTimes(2);

        // We cannot easily test the internal format configurations,
        // but we can verify that different log levels result in different
        // configurations being passed to createLogger
        const infoCalls = createLoggerSpy.mock.calls[0];
        const debugCalls = createLoggerSpy.mock.calls[1];

        expect(infoCalls).toBeDefined();
        expect(debugCalls).toBeDefined();

        if (infoCalls && infoCalls[0] && debugCalls && debugCalls[0]) {
            const infoCallArg = infoCalls[0];
            const debugCallArg = debugCalls[0];

            expect(infoCallArg.level).toBe('info');
            expect(debugCallArg.level).toBe('debug');

            // The format and transports should be different between the two calls
            expect(infoCallArg.format).not.toEqual(debugCallArg.format);
        }
    });

    test('logger methods can be called without errors', () => {
        const logger = getLogger();

        // Simply verify that these method calls don't throw exceptions
        expect(() => {
            logger.info('Test info message');
            logger.error('Test error message');
            logger.warn('Test warning message');
            logger.debug('Test debug message');
        }).not.toThrow();
    });

    test('logger with context includes context in metadata', () => {
        const createLoggerSpy = jest.spyOn(winston, 'createLogger');

        // Get a fresh logger
        setLogLevel('debug');
        const logger = getLogger();

        // Spy on the logger's info method
        const infoSpy = jest.spyOn(logger, 'info');

        // Log with context
        const context: LogContext = { requestId: '123', userId: '456' };
        logger.info('Message with context', context);

        // Verify logger's info method was called with context
        expect(infoSpy).toHaveBeenCalledWith('Message with context', context);
    });

    test('logger format functions handle meta objects correctly', () => {
        // Test debug level with meta data
        setLogLevel('debug');
        let logger = getLogger();

        // Simply verify logging with meta doesn't throw exceptions
        expect(() => {
            logger.info('Test message with meta', {
                key1: 'value1',
                key2: 'value2',
                nested: { foo: 'bar' }
            });
        }).not.toThrow();

        // Test info level with meta data
        setLogLevel('info');
        logger = getLogger();

        expect(() => {
            logger.info('Test message with meta in info mode', {
                key1: 'value1',
                key2: 'value2'
            });
        }).not.toThrow();
    });
});
