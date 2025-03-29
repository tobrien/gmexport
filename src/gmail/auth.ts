import * as fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import * as path from 'path';
import * as readline from 'readline';
import { getLogger } from '../logging.js';
import { Configuration } from '../types.js';

export const create = (config: Configuration) => {
    const logger = getLogger();

    async function authorize(): Promise<OAuth2Client> {
        const credentials = JSON.parse(fs.readFileSync(path.join(config.credentials.credentials_file), 'utf-8'));
        const { client_secret, client_id, redirect_uris } = credentials.installed;

        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        try {
            const token = fs.readFileSync(path.join(config.credentials.token_file), 'utf-8');
            oAuth2Client.setCredentials(JSON.parse(token));
            return oAuth2Client;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            return await getNewToken(oAuth2Client);
        }
    }

    async function getNewToken(oAuth2Client: OAuth2Client): Promise<OAuth2Client> {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: config.api.scopes,
        });

        logger.info('Please authorize this app by visiting this URL: %s', authUrl);

        const code = await new Promise<string>((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question('Enter the code from that page here: ', (code: string) => {
                rl.close();
                resolve(code);
            });
        });

        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(path.join(config.credentials.token_file), JSON.stringify(tokens));
        return oAuth2Client;
    }

    return {
        authorize,
    }
};

