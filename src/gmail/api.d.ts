import { gmail_v1 } from 'googleapis';

export interface Instance {
    listLabels: (params: gmail_v1.Params$Resource$Users$Labels$List) => Promise<gmail_v1.Schema$Label[]>;
    listMessages: (params: gmail_v1.Params$Resource$Users$Messages$List, callback: (messages: gmail_v1.Schema$Message[]) => Promise<void>) => Promise<void>;
    getMessage: (params: gmail_v1.Params$Resource$Users$Messages$Get) => Promise<gmail_v1.Schema$Message | null>;
    getAttachment: (params: gmail_v1.Params$Resource$Users$Messages$Attachments$Get) => Promise<gmail_v1.Schema$MessagePartBody | null>;
}