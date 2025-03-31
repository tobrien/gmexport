import * as yaml from 'js-yaml';
import * as Storage from './util/storage.js';
import { getLogger } from './logging.js';
import { deepMerge } from './util/general.js';
import { Input } from './arguments.js';
import { DEFAULT_CHARACTER_ENCODING, DEFAULT_CREDENTIALS_FILE, DEFAULT_DESTINATION_DIR, DEFAULT_FILENAME_OPTIONS, DEFAULT_OUTPUT_STRUCTURE, DEFAULT_SCOPES, DEFAULT_TOKEN_FILE } from './constants.js';

// Update the REQUIRED_FIELDS type definition for better type safety
type Field = {
    name: string;
    variable: keyof Config | keyof Input;
    default: any;
    validations?: FieldValidation[];
};

type FieldValidation = (field: Field, config: Partial<Config>) => Promise<void>;

export type FilenameOption = 'date' | 'time' | 'subject';
export type OutputStructure = 'none' | 'year' | 'month' | 'day';

export interface MessageFilter {
    labels?: string[];
    from?: string[];
    to?: string[];
    subject?: string[];
}

// Configuration type definition
export interface Config {
    outputDirectory: string;
    outputStructure: OutputStructure;
    filenameOptions: FilenameOption[];
    credentialsFile: string;
    tokenFile: string;
    apiScopes: string[];
    filters?: {
        exclude?: MessageFilter;
        include?: MessageFilter;
    };
}

export type InputParameters = {
    configFile?: string;
    outputStructure?: OutputStructure;
    filenameOptions?: FilenameOption[];
    outputDirectory?: string;
    credentialsFile?: string;
    tokenFile?: string;
    apiScopes?: string[];
};
