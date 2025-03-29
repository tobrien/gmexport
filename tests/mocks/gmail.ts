import { jest } from '@jest/globals';
import { GaxiosResponse } from 'gaxios';
import { gmail_v1 } from 'googleapis';

export const mockGmail = {
    users: {
        labels: {
            list: jest.fn() as unknown as jest.Mock<() => Promise<GaxiosResponse<gmail_v1.Schema$ListLabelsResponse>>>
        },
        messages: {
            list: jest.fn() as unknown as jest.Mock<() => Promise<GaxiosResponse<gmail_v1.Schema$ListMessagesResponse>>>,
            get: jest.fn() as unknown as jest.Mock<() => Promise<GaxiosResponse<gmail_v1.Schema$Message>>>
        }
    }
};

export const createMockLabelsResponse = (labels: gmail_v1.Schema$Label[]): GaxiosResponse<gmail_v1.Schema$ListLabelsResponse> => ({
    data: { labels },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
    request: { responseURL: 'https://gmail.googleapis.com/gmail/v1/users/me/labels' }
});

export const createMockMessagesResponse = (messages: gmail_v1.Schema$Message[], nextPageToken?: string): GaxiosResponse<gmail_v1.Schema$ListMessagesResponse> => ({
    data: { messages, nextPageToken },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
    request: { responseURL: 'https://gmail.googleapis.com/gmail/v1/users/me/messages' }
});

export const createMockMessageResponse = (message: gmail_v1.Schema$Message): GaxiosResponse<gmail_v1.Schema$Message> => ({
    data: message,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
    request: { responseURL: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}` }
}); 