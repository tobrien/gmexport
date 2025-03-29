import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { getLogger } from './logging.js';
import { CommandLineArgs, Configuration, FilenameOption } from './types.js';

// Internal default configuration values
export const DEFAULT_CREDENTIALS_FILE = './credentials.json';
export const DEFAULT_TOKEN_FILE = './token.json';
export const DEFAULT_MAX_RESULTS = 10000;
export const DEFAULT_DESTINATION_DIR = './exports';
export const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
export const DEFAULT_OUTPUT_STRUCTURE = 'month';
export const DEFAULT_FILENAME_OPTIONS = ['date', 'time', 'subject'];
export const DEFAULT_TIMEZONE = 'America/New_York';

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
        dry_run: false,
        output_structure: DEFAULT_OUTPUT_STRUCTURE,
        filename_options: DEFAULT_FILENAME_OPTIONS as FilenameOption[],
        timezone: DEFAULT_TIMEZONE
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
    let config: Configuration = { ...defaultConfig };

    // Override with command line arguments
    if (args.config) {
        try {
            const configFile = fs.readFileSync(args.config, 'utf8');
            const fileConfig = yaml.load(configFile);
            config = deepMerge(config, fileConfig);
        } catch (error: any) {
            logger.error('Error reading config file: %s %s', error.message, error.stack);
            process.exit(1);
        }
    }

    // Override with command line arguments
    if (args.output) {
        config.export.destination_dir = args.output;
    }

    if (args.dryRun) {
        config.export.dry_run = true;
    }

    if (args.outputStructure) {
        if (!['year', 'month', 'day'].includes(args.outputStructure)) {
            logger.error('Invalid output structure. Must be one of: year, month, day');
            process.exit(1);
        }
        config.export.output_structure = args.outputStructure as 'year' | 'month' | 'day';
    }

    // Handle filename options
    if (args.filenameOptions) {
        config.export.filename_options = args.filenameOptions;
    }

    return config;
}