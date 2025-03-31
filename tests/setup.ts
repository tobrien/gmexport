import { jest } from '@jest/globals';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Configure dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

// Store original console methods
const originalConsole = { ...console };

// Configure longer timeout for tests
jest.setTimeout(30000);

// Suppress console output during tests but keep errors for debugging
// console.log = jest.fn();
// console.info = jest.fn();
// console.warn = jest.fn();
// console.error = originalConsole.error;

// Export function to restore console if needed in tests
export function restoreConsole() {
    Object.assign(console, originalConsole);
}

// Mock process.exit to prevent actual process termination
process.exit = jest.fn() as unknown as (code?: number) => never; 