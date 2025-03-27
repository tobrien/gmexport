import { jest } from '@jest/globals';

// Increase the timeout for all tests
jest.setTimeout(30000);

// Mock console methods to prevent output during tests
global.console = {
    ...console,
    // Keep error logging for debugging
    error: jest.fn(),
    // Suppress other console output
    log: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// Mock process.exit to prevent actual process termination
process.exit = jest.fn() as unknown as (code?: number) => never; 