import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { getLogger } from './logging.js';
import { CommandLineArgs, Configuration } from './types';

// Internal default configuration values
export const DEFAULT_CREDENTIALS_FILE = './credentials.json';
export const DEFAULT_TOKEN_FILE = './token.json';
export const DEFAULT_MAX_RESULTS = 10000;
export const DEFAULT_DESTINATION_DIR = './exports';
export const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];


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
const defaultConfig: Configuration = {
    credentials: {
        credentials_file: DEFAULT_CREDENTIALS_FILE,
        token_file: DEFAULT_TOKEN_FILE
    },
    export: {
        max_results: DEFAULT_MAX_RESULTS,
        destination_dir: DEFAULT_DESTINATION_DIR,
        dry_run: false
    },
    api: {
        scopes: DEFAULT_SCOPES
    },
    filters: {
        exclude: {},
        include: {}
    }
};

export function createConfiguration(args: CommandLineArgs): Configuration {
    const logger = getLogger();
    let config = defaultConfig;

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
            logger.error('Error loading configuration from config.yaml:', { error });
            logger.warn('Using default configuration.');
        }
    } else {
        logger.warn(`Configuration file not found at ${configFilePath}. Using default configuration.`);
    }

    return config;
}