import { GaxiosResponse } from 'gaxios';
import { OAuth2Client } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';
import { getLogger } from '../logging';
import { Instance } from './api.d';

export const create = (auth: OAuth2Client): Instance => {
    const gmail = google.gmail({ version: 'v1', auth });


    // Add this function to get all labels
    async function listLabels(params: gmail_v1.Params$Resource$Users$Labels$List): Promise<gmail_v1.Schema$Label[]> {
        const logger = getLogger();
        logger.debug('Fetching labels with params: %j', params);
        const response: GaxiosResponse<gmail_v1.Schema$ListLabelsResponse> = await gmail.users.labels.list(params);

        const labels: gmail_v1.Schema$Label[] = response.data.labels || [];
        return labels;
    }


    async function listMessages(params: gmail_v1.Params$Resource$Users$Messages$List, callback: (messages: gmail_v1.Schema$Message[]) => Promise<void>): Promise<void> {
        const logger = getLogger();

        logger.debug('Fetching messages with params: %j', params);
        let nextPageToken: string | undefined;
        do {
            if (nextPageToken) {
                logger.info('Fetching Next Page of Messages with pageToken: %s', nextPageToken);
            }

            const res: GaxiosResponse<gmail_v1.Schema$ListMessagesResponse> = await gmail.users.messages.list({
                ...params,
                pageToken: nextPageToken
            });

            const messages = res.data.messages || [];
            logger.info('Found %d messages for params: %j', messages.length, params);

            await callback(messages);

            nextPageToken = res.data.nextPageToken || undefined;
        } while (nextPageToken);
    }

    async function getMessage(params: gmail_v1.Params$Resource$Users$Messages$Get): Promise<gmail_v1.Schema$Message | null> {
        const logger = getLogger();
        logger.debug('Fetching message with params: %j', params);
        const emailResponse: GaxiosResponse<gmail_v1.Schema$Message> = await gmail.users.messages.get(params);

        return emailResponse.data;
    }

    async function getAttachment(params: gmail_v1.Params$Resource$Users$Messages$Attachments$Get): Promise<gmail_v1.Schema$MessagePartBody | null> {
        const logger = getLogger();
        logger.debug('Fetching attachment with params: %j', params);
        const attachmentResponse: GaxiosResponse<gmail_v1.Schema$MessagePartBody> = await gmail.users.messages.attachments.get(params);

        return attachmentResponse.data;
    }

    return {
        listLabels: listLabels,
        listMessages: listMessages,
        getMessage: getMessage,
        getAttachment: getAttachment
    }
}




