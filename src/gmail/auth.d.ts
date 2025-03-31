import { OAuth2Client } from 'google-auth-library';

export interface Instance {
    authorize: () => Promise<OAuth2Client>;
}