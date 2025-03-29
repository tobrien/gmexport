import { jest } from '@jest/globals';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as Auth from '../src/gmail/auth';
import { Configuration } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

jest.mock('googleapis');
jest.mock('google-auth-library');
jest.mock('fs');
jest.mock('path');
jest.mock('readline');

describe('authenticate', () => {
    let mockAuth: jest.Mocked<typeof google.auth>;
    let mockOAuth2Client: jest.Mocked<OAuth2Client>;
    let mockConfig: Configuration;
    let mockCredentials: any;
    let mockReadlineInterface: any;

    beforeEach(() => {
        mockOAuth2Client = {
            setCredentials: jest.fn(),
            getToken: jest.fn(),
            credentials: {},
            generateAuthUrl: jest.fn().mockReturnValue('https://test-auth-url'),
        } as unknown as jest.Mocked<OAuth2Client>;

        mockAuth = {
            OAuth2: jest.fn().mockReturnValue(mockOAuth2Client),
        } as unknown as jest.Mocked<typeof google.auth>;

        // Mock readline interface to immediately return a test code
        mockReadlineInterface = {
            question: jest.fn().mockImplementation((prompt: unknown, callback: unknown) => {
                (callback as (answer: string) => void)('test-code');
            }),
            close: jest.fn(),
        };

        (readline.createInterface as jest.Mock).mockReturnValue(mockReadlineInterface);

        mockCredentials = {
            installed: {
                client_id: 'test-client-id',
                client_secret: 'test-client-secret',
                redirect_uris: ['test-redirect-uri']
            }
        };

        // Mock fs.readFileSync
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: unknown) => {
            const path = filePath as string;
            if (path.includes('test-credentials.json')) {
                return JSON.stringify(mockCredentials);
            }
            if (path.includes('test-token.json')) {
                throw new Error('Token file not found');
            }
            throw new Error('File not found');
        });

        // Mock fs.writeFileSync
        (fs.writeFileSync as jest.Mock).mockImplementation(() => { });

        // Mock path.join
        (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

        mockConfig = {
            credentials: {
                credentials_file: './test-credentials.json',
                token_file: './test-token.json'
            },
            api: {
                scopes: ['test.scope']
            },
            export: {
                max_results: 1000,
                destination_dir: './test-exports',
                start_date: '2024-01-01',
                end_date: '2024-12-31',
                dry_run: false
            },
            filters: {
                include: {},
                exclude: {
                    labels: ['test-exclude-label'],
                    from: ['test@example.com'],
                    subject: ['Test Subject'],
                    to: ['test@example.com']
                }
            }
        } as Configuration;

        (google.auth as unknown) = mockAuth;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create OAuth2 client with correct credentials', async () => {
        const tokens = {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
        };

        // @ts-expect-error - mockResolvedValue is not typed
        mockOAuth2Client.getToken.mockResolvedValue({ tokens });

        const auth = await Auth.create(mockConfig).authorize();

        expect(mockAuth.OAuth2).toHaveBeenCalledWith(
            mockCredentials.installed.client_id,
            mockCredentials.installed.client_secret,
            mockCredentials.installed.redirect_uris[0]
        );
        expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('test-code');
        expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(tokens);
        expect(auth).toBe(mockOAuth2Client);
    });
});
