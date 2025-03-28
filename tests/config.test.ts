import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createConfig } from '../src/config';
import { getLogger } from '../src/logging';

// Mock the logging module
jest.mock('../src/logging', () => ({
    getLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('fs');
jest.mock('js-yaml');

describe('createConfig', () => {
    const mockArgs = {
        config: 'test-config.yaml',
        output: './test-output',
        start: '2024-01-01',
        end: '2024-01-31',
        dryRun: false
    };

    const mockFileConfig = {
        credentials: {
            credentials_file: 'custom-creds.json',
            token_file: 'custom-token.json'
        },
        filters: {
            include: {
                labels: ['test-include-label'],
                from: ['test@example.com'],
                subject: ['Test Subject'],
                to: ['test@example.com']
            },
            exclude: {
                labels: ['SPAM'],
                from: ['spam@example.com'],
                subject: ['spam subject'],
                to: ['test@example.com']
            }
        }
    };

    let mockLogger: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        };
        (getLogger as jest.Mock).mockReturnValue(mockLogger);
    });

    it('should use command line arguments for export settings', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const config = createConfig(mockArgs);

        expect(config.export.destination_dir).toBe(mockArgs.output);
        expect(config.export.dry_run).toBe(mockArgs.dryRun);
    });

    it('should merge file config with defaults when config file exists', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('dummy yaml content');
        (yaml.load as jest.Mock).mockReturnValue(mockFileConfig);

        const config = createConfig(mockArgs);

        expect(config.credentials.credentials_file).toBe(mockFileConfig.credentials.credentials_file);
        expect(config.credentials.token_file).toBe(mockFileConfig.credentials.token_file);
        expect(config.filters.include.labels).toEqual(mockFileConfig.filters.include.labels);
        expect(config.filters.include.from).toEqual(mockFileConfig.filters.include.from);
        expect(config.filters.include.subject).toEqual(mockFileConfig.filters.include.subject);
        expect(config.filters.include.to).toEqual(mockFileConfig.filters.include.to);
        expect(config.filters.exclude.labels).toEqual(mockFileConfig.filters.exclude.labels);
        expect(config.filters.exclude.from).toEqual(mockFileConfig.filters.exclude.from);
        expect(config.filters.exclude.subject).toEqual(mockFileConfig.filters.exclude.subject);
        // Command line args should still override
        expect(config.export.destination_dir).toBe(mockArgs.output);
    });

    it('should use default config when config file does not exist', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const config = createConfig(mockArgs);

        expect(config.credentials.credentials_file).toBe('custom-creds.json');
        expect(config.credentials.token_file).toBe('custom-token.json');
        expect(config.filters.include.labels).toEqual(["test-include-label"]);
        expect(config.filters.include.from).toEqual(["test@example.com"]);
        expect(config.filters.include.subject).toEqual(["Test Subject"]);
        expect(config.filters.include.to).toEqual(["test@example.com"]);
        expect(config.filters.exclude.labels).toEqual(["SPAM"]);
        expect(config.filters.exclude.from).toEqual(["spam@example.com"]);
        expect(config.filters.exclude.subject).toEqual(["spam subject"]);
        expect(config.filters.exclude.to).toEqual(["test@example.com"]);

        // Verify warning was logged
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Configuration file not found at')
        );
    });

    it('should handle invalid config file content', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('invalid: yaml: content');
        (yaml.load as jest.Mock).mockImplementation(() => {
            throw new Error('YAML parsing error');
        });

        const config = createConfig(mockArgs);

        // Verify error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error loading configuration from config.yaml:',
            { error: expect.any(Error) }
        );
        expect(mockLogger.warn).toHaveBeenCalledWith('Using default configuration.');

        // Verify default config was used
        expect(config.credentials.credentials_file).toBe('custom-creds.json');
    });
});
