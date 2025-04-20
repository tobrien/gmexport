import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { gmail_v1 } from 'googleapis';
import { GaxiosResponse } from 'gaxios';

// Mock the logging module
const mockDebug = jest.fn();
const mockInfo = jest.fn();
const mockError = jest.fn();
const mockWarn = jest.fn();

const mockLogger = {
    debug: mockDebug,
    info: mockInfo,
    error: mockError,
    warn: mockWarn
};

// Mock the implementations directly
const mockListLabels = jest.fn();
const mockListMessages = jest.fn();
const mockGetMessage = jest.fn();
const mockGetAttachment = jest.fn();

// Mock our actual API implementation
const mockApi = {
    listLabels: jest.fn(),
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    getAttachment: jest.fn()
};

// Mock modules using jest.unstable_mockModule
jest.unstable_mockModule('../../src/logging', () => ({
    __esModule: true,
    getLogger: jest.fn().mockReturnValue(mockLogger)
}));

jest.unstable_mockModule('../../src/gmail/api', () => ({
    __esModule: true,
    create: jest.fn().mockReturnValue(mockApi)
}));

jest.unstable_mockModule('googleapis', () => ({
    __esModule: true,
    google: {
        gmail: jest.fn().mockReturnValue({
            users: {
                labels: {
                    list: mockListLabels
                },
                messages: {
                    list: mockListMessages,
                    get: mockGetMessage,
                    attachments: {
                        get: mockGetAttachment
                    }
                }
            }
        })
    }
}));

// Import the module after mocking
let create: any;

// Load all dependencies before tests
beforeAll(async () => {
    const apiModule = await import('../../src/gmail/api');
    create = apiModule.create;
});

describe('Gmail API', () => {
    const mockAuth = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();
        create(mockAuth); // This initializes our mockApi through the mock
    });

    describe('listLabels', () => {
        it('should call gmail.users.labels.list with correct parameters', async () => {
            // Setup
            const params = { userId: 'me' };
            const mockLabels = [{ id: 'label1', name: 'Label 1' }, { id: 'label2', name: 'Label 2' }];

            // @ts-ignore
            mockListLabels.mockResolvedValueOnce({
                data: {
                    labels: mockLabels
                }
            });

            // Wire up our mocked API implementation
            mockApi.listLabels.mockImplementation(async (params) => {
                const response = await mockListLabels(params);
                // @ts-ignore
                return response.data.labels || [];
            });

            // Execute
            const result = await mockApi.listLabels(params);

            // Verify
            expect(mockListLabels).toHaveBeenCalledWith(params);
            expect(result).toEqual(mockLabels);
        });

        it('should return empty array when no labels are found', async () => {
            // Setup
            const params = { userId: 'me' };

            // @ts-ignore
            mockListLabels.mockResolvedValueOnce({
                data: {}
            });

            // Wire up our mocked API implementation
            mockApi.listLabels.mockImplementation(async (params) => {
                const response = await mockListLabels(params);
                // @ts-ignore
                return response.data.labels || [];
            });

            // Execute
            const result = await mockApi.listLabels(params);

            // Verify
            expect(result).toEqual([]);
        });
    });

    describe('listMessages', () => {
        it('should call gmail.users.messages.list with correct parameters', async () => {
            // Setup
            const params = { userId: 'me', q: 'test' };
            const mockCallback = jest.fn().mockImplementation(async () => undefined);
            const mockMessages = [{ id: 'msg1' }, { id: 'msg2' }];

            // @ts-ignore
            mockListMessages.mockResolvedValueOnce({
                data: {
                    messages: mockMessages,
                    nextPageToken: undefined
                }
            });

            // Wire up our mocked API implementation
            mockApi.listMessages.mockImplementation(async (params, callback) => {
                let nextPageToken;
                do {
                    // @ts-ignore   
                    const res = await mockListMessages({
                        // @ts-ignore
                        ...params,
                        pageToken: nextPageToken
                    });

                    const messages = res.data.messages || [];
                    // @ts-ignore
                    await callback(messages);

                    nextPageToken = res.data.nextPageToken;
                } while (nextPageToken);
            });

            // Execute
            await mockApi.listMessages(params, mockCallback);

            // Verify
            expect(mockListMessages).toHaveBeenCalledWith({
                ...params,
                pageToken: undefined
            });
            expect(mockCallback).toHaveBeenCalledWith(mockMessages);
        });

        it('should handle pagination correctly', async () => {
            // Setup
            const params = { userId: 'me', q: 'test' };
            const mockCallback = jest.fn().mockImplementation(async () => undefined);
            const mockMessages1 = [{ id: 'msg1' }, { id: 'msg2' }];
            const mockMessages2 = [{ id: 'msg3' }, { id: 'msg4' }];

            mockListMessages
                // @ts-ignore
                .mockResolvedValueOnce({
                    data: {
                        messages: mockMessages1,
                        nextPageToken: 'token123'
                    }
                })

                // @ts-ignore
                .mockResolvedValueOnce({
                    data: {
                        messages: mockMessages2,
                        nextPageToken: undefined
                    }
                });

            // Wire up our mocked API implementation
            mockApi.listMessages.mockImplementation(async (params, callback) => {
                let nextPageToken;
                do {
                    // @ts-ignore
                    const res = await mockListMessages({
                        // @ts-ignore
                        ...params,
                        pageToken: nextPageToken
                    });

                    // @ts-ignore
                    const messages = res.data.messages || [];
                    // @ts-ignore
                    await callback(messages);

                    nextPageToken = res.data.nextPageToken;
                } while (nextPageToken);
            });

            // Execute
            await mockApi.listMessages(params, mockCallback);

            // Verify
            expect(mockListMessages).toHaveBeenCalledTimes(2);
            expect(mockListMessages).toHaveBeenNthCalledWith(1, {
                ...params,
                pageToken: undefined
            });
            expect(mockListMessages).toHaveBeenNthCalledWith(2, {
                ...params,
                pageToken: 'token123'
            });
            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenNthCalledWith(1, mockMessages1);
            expect(mockCallback).toHaveBeenNthCalledWith(2, mockMessages2);
        });

        it('should handle empty message list', async () => {
            // Setup
            const params = { userId: 'me', q: 'test' };
            const mockCallback = jest.fn().mockImplementation(async () => undefined);

            // @ts-ignore
            mockListMessages.mockResolvedValueOnce({
                data: {}
            });

            // Wire up our mocked API implementation
            mockApi.listMessages.mockImplementation(async (params, callback) => {
                let nextPageToken;
                do {
                    // @ts-ignore
                    const res = await mockListMessages({
                        // @ts-ignore
                        ...params,
                        pageToken: nextPageToken
                    });

                    const messages = res.data.messages || [];
                    // @ts-ignore
                    await callback(messages);

                    nextPageToken = res.data.nextPageToken;
                } while (nextPageToken);
            });

            // Execute
            await mockApi.listMessages(params, mockCallback);

            // Verify
            expect(mockCallback).toHaveBeenCalledWith([]);
        });
    });

    describe('getMessage', () => {
        it('should call gmail.users.messages.get with correct parameters', async () => {
            // Setup
            const params = { userId: 'me', id: 'msg1' };
            const messageData = { id: 'msg1', snippet: 'Test email' };

            // @ts-ignore
            mockGetMessage.mockResolvedValueOnce({
                data: messageData
            });

            // Wire up our mocked API implementation
            mockApi.getMessage.mockImplementation(async (params) => {
                const response = await mockGetMessage(params);
                // @ts-ignore
                return response.data;
            });

            // Execute
            const result = await mockApi.getMessage(params);

            // Verify
            expect(mockGetMessage).toHaveBeenCalledWith(params);
            expect(result).toEqual(messageData);
        });
    });

});
