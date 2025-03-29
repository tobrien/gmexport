import { jest } from '@jest/globals';
import { GaxiosResponse } from 'gaxios';
import { gmail_v1 } from 'googleapis';
import { getLogger } from '../../src/logging.js';
import * as Api from '../../src/gmail/api.js';

jest.mock('../../src/logging.js');
jest.mock('googleapis', () => ({
    google: {
        gmail: jest.fn().mockReturnValue({
            users: {
                labels: {
                    list: jest.fn()
                },
                messages: {
                    list: jest.fn(),
                    get: jest.fn()
                }
            }
        })
    }
}));

describe('Gmail API', () => {
    const mockLogger = {
        info: jest.fn(),
        debug: jest.fn()
    };
    const mockAuth = {} as any;
    let api: Api.Instance;
    let mockGmail: any;

    beforeEach(() => {
        jest.clearAllMocks();
        (getLogger as jest.Mock).mockReturnValue(mockLogger);
        api = Api.create(mockAuth);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mockGmail = (require('googleapis').google.gmail());
    });

    describe('fetchLabels', () => {
        it('should fetch and return labels', async () => {
            const mockLabels = [
                { id: '1', name: 'Label1' },
                { id: '2', name: 'Label2' }
            ];
            const mockResponse: GaxiosResponse<gmail_v1.Schema$ListLabelsResponse> = {
                data: { labels: mockLabels },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
                request: { responseURL: 'https://gmail.googleapis.com/gmail/v1/users/me/labels' }
            };

            mockGmail.users.labels.list.mockResolvedValue(mockResponse);

            const result = await api.listLabels({ userId: 'me' });

            expect(result).toEqual(mockLabels);
            expect(mockGmail.users.labels.list).toHaveBeenCalledWith({ userId: 'me' });
            expect(mockLogger.debug).toHaveBeenCalled();
        });

        it('should handle empty labels response', async () => {
            const mockResponse: GaxiosResponse<gmail_v1.Schema$ListLabelsResponse> = {
                data: {},
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
                request: { responseURL: 'https://gmail.googleapis.com/gmail/v1/users/me/labels' }
            };

            mockGmail.users.labels.list.mockResolvedValue(mockResponse);

            const result = await api.listLabels({ userId: 'me' });

            expect(result).toEqual([]);
        });
    });

    describe('fetchMessages', () => {
        it('should fetch messages and handle pagination', async () => {
            const mockMessages1 = [{ id: '1' }, { id: '2' }];
            const mockMessages2 = [{ id: '3' }, { id: '4' }];

            mockGmail.users.messages.list
                .mockResolvedValueOnce({
                    data: { messages: mockMessages1, nextPageToken: 'token1' }
                })
                .mockResolvedValueOnce({
                    data: { messages: mockMessages2 }
                });

            const mockCallback = jest.fn();
            await api.listMessages({ userId: 'me' }, mockCallback);

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenCalledWith(mockMessages1);
            expect(mockCallback).toHaveBeenCalledWith(mockMessages2);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        it('should handle empty messages response', async () => {
            mockGmail.users.messages.list.mockResolvedValue({
                data: {}
            });

            const mockCallback = jest.fn();
            await api.listMessages({ userId: 'me' }, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith([]);
        });
    });

    describe('fetchMessage', () => {
        it('should fetch single message', async () => {
            const mockMessage = {
                id: '123',
                payload: { headers: [] }
            };

            mockGmail.users.messages.get.mockResolvedValue({
                data: mockMessage
            });

            const result = await api.getMessage({ userId: 'me', id: '123' });

            expect(result).toEqual(mockMessage);
            expect(mockGmail.users.messages.get).toHaveBeenCalledWith({
                userId: 'me',
                id: '123'
            });
            expect(mockLogger.debug).toHaveBeenCalled();
        });
    });
});
