import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { CommandLineArgs } from './main';

// Internal default configuration values
export const DEFAULT_CREDENTIALS_FILE = './credentials.json';
export const DEFAULT_TOKEN_FILE = './token.json';
export const DEFAULT_MAX_RESULTS = 10000;
export const DEFAULT_DESTINATION_DIR = './exports';
export const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
export const DEFAULT_CONFIG_FILE = './config.yaml';
// Get date 31 days ago in YYYY-MM-DD format
const date = new Date();
date.setDate(date.getDate() - 31);
export const DEFAULT_START_DATE = date.toISOString().split('T')[0];
export const DEFAULT_END_DATE = new Date().toISOString().split('T')[0];


// Configuration type definition
export interface Config {
    credentials: {
        credentials_file: string;
        token_file: string;
    };
    export: {
        max_results: number;
        destination_dir: string;
        start_date: string;
        end_date: string;
        dry_run: boolean;
    };
    api: {
        scopes: string[];
    };
    filters: {
        skip_labels: string[];
        skip_emails: {
            from: string[];
            subject: string[];
        };
    };
}

// Utility function for deep merging two objects.
function deepMerge(target: any, source: any): any {
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) {
                    target[key] = {};
                }
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
}

// Default configuration
const defaultConfig: Config = {
    credentials: {
        credentials_file: DEFAULT_CREDENTIALS_FILE,
        token_file: DEFAULT_TOKEN_FILE
    },
    export: {
        max_results: DEFAULT_MAX_RESULTS,
        destination_dir: DEFAULT_DESTINATION_DIR,
        start_date: DEFAULT_START_DATE,
        end_date: DEFAULT_END_DATE,
        dry_run: false
    },
    api: {
        scopes: DEFAULT_SCOPES
    },
    filters: {
        skip_labels: [],
        skip_emails: {
            from: [],
            subject: []
        }
    }
};

export function createConfig(args: CommandLineArgs): Config {

    let config = defaultConfig;

    config.export.start_date = args.start;
    config.export.end_date = args.end;
    config.export.destination_dir = args.output;
    config.export.dry_run = args.dryRun;

    // Attempt to load config.yaml from the current directory
    const configFilePath = path.resolve(args.config);
    if (fs.existsSync(configFilePath)) {
        try {
            const configFile = fs.readFileSync(configFilePath, 'utf8');
            const fileConfig = yaml.load(configFile);
            if (fileConfig && typeof fileConfig === 'object') {
                config = deepMerge(defaultConfig, fileConfig);
            }
        } catch (error) {
            console.error('Error loading configuration from config.yaml:', error);
            console.warn('Using default configuration.');
        }
    } else {
        console.warn(`Configuration file not found at ${configFilePath}. Using default configuration.`);
    }

    return config;
}