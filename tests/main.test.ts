import { jest } from '@jest/globals';
import { Command } from 'commander';
import * as Auth from '../src/auth';
import * as Config from '../src/config';
import * as Gmail from '../src/gmail';
import { main } from '../src/main';

// Mock all dependencies
jest.mock('commander', () => {
    const mockCommand = jest.fn().mockImplementation(() => {
        const instance = {
            name: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            requiredOption: jest.fn().mockReturnThis(),
            version: jest.fn().mockReturnThis(),
            parse: jest.fn(),
            opts: jest.fn().mockReturnValue({
                config: 'test-config.yaml',
                output: './test-output',
                start: '2024-01-01',
                end: '2024-01-31',
                dryRun: false
            })
        };
        return instance;
    });
    return { Command: mockCommand };
});

// Mock auth module to prevent interactive prompt
jest.mock('../src/auth', () => ({
    create: jest.fn().mockReturnValue({
        authorize: jest.fn().mockResolvedValue('mock-auth-client' as unknown as never)
    })
}));

jest.mock('../src/config');
jest.mock('../src/gmail');

describe('main', () => {
    let mockAuth: any;
    let mockGmail: any;
    let mockConfig: any;
    let consoleErrorSpy: any;
    let processExitSpy: any;
    let consoleLogSpy: any;
    let mockCommandInstance: any;

    beforeEach(() => {
        // Get the mock Command instance
        mockCommandInstance = {
            name: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            requiredOption: jest.fn().mockReturnThis(),
            version: jest.fn().mockReturnThis(),
            parse: jest.fn(),
            opts: jest.fn().mockReturnValue({
                config: 'test-config.yaml',
                output: './test-output',
                start: '2024-01-01',
                end: '2024-01-31',
                dryRun: false
            })
        };
        (Command as jest.Mock).mockImplementation(() => mockCommandInstance);

        // Mock Auth
        mockAuth = {
            authorize: jest.fn().mockResolvedValue('mock-auth-client' as unknown as never)
        };
        (Auth.create as jest.Mock).mockReturnValue(mockAuth);

        // Mock Gmail
        mockGmail = {
            exportEmails: jest.fn().mockResolvedValue(undefined as unknown as never)
        };
        (Gmail.create as jest.Mock).mockReturnValue(mockGmail);

        // Mock Config
        mockConfig = {
            credentials: {
                credentials_file: 'test-creds.json',
                token_file: 'test-token.json'
            },
            export: {
                max_results: 1000,
                destination_dir: './test-output',
                start_date: '2024-01-01',
                end_date: '2024-01-31',
                dry_run: false
            },
            filters: {
                skip_labels: [],
                skip_emails: {
                    from: [],
                    subject: []
                }
            }
        };
        (Config.createConfig as jest.Mock).mockReturnValue(mockConfig);

        // Spy on console and process.exit
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it('should successfully execute with valid parameters', async () => {
        await main();

        expect(mockCommandInstance.name).toHaveBeenCalledWith('gmail-export');
        expect(mockCommandInstance.parse).toHaveBeenCalled();
        expect(Config.createConfig).toHaveBeenCalled();
        expect(Auth.create).toHaveBeenCalledWith(mockConfig);
        expect(mockAuth.authorize).toHaveBeenCalled();
        expect(Gmail.create).toHaveBeenCalledWith(mockConfig, 'mock-auth-client');
        expect(mockGmail.exportEmails).toHaveBeenCalled();
        expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with error for invalid date format', async () => {
        // Override the mock Command instance's opts method for this test
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            start: 'invalid-date',
            end: '2024-01-31',
            dryRun: false
        });

        await main();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid date format. Please use YYYY-MM-DD');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit with error when end date is before start date', async () => {
        // Override the mock Command instance's opts method for this test
        mockCommandInstance.opts.mockReturnValue({
            config: 'test-config.yaml',
            output: './test-output',
            start: '2024-01-31',
            end: '2024-01-01',
            dryRun: false
        });

        await main();

        expect(consoleErrorSpy).toHaveBeenCalledWith('End date must be after start date');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});
