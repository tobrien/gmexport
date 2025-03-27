import * as yaml from 'js-yaml';
import * as Storage from './util/storage';
import { getLogger } from './logging';
import { deepMerge } from './util/general';
import { Input } from './arguments.d';
import { DEFAULT_CHARACTER_ENCODING, DEFAULT_CREDENTIALS_FILE, DEFAULT_DESTINATION_DIR, DEFAULT_FILENAME_OPTIONS, DEFAULT_OUTPUT_STRUCTURE, DEFAULT_SCOPES, DEFAULT_TOKEN_FILE } from './constants';
import { FieldValidation, Config, InputParameters, Field } from './export.d';

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'Export.ConfigError';
    }
}

const isDirectoryWriteable: FieldValidation = async (field, config) => {
    const storage = Storage.create({ log: getLogger().debug });
    const directory = config[field.variable as keyof Config] as string;
    const logger = getLogger();
    logger.info(`Checking if directory is writeable: ${directory}`);
    if (!(await storage.isDirectoryWritable(directory))) {
        logger.error(`Directory is not writeable: ${directory}.`);
        throw new ConfigError(`Directory is not writeable: ${directory}.`);
    }
    logger.info(`Directory is writeable: ${directory}.`);
    return;
}

const isFileReadable: FieldValidation = async (field, config) => {
    const storage = Storage.create({ log: getLogger().debug });
    const file = config[field.variable as keyof Config] as string;
    const logger = getLogger();
    logger.info(`Checking if file is readable: ${file}`);
    if (!(await storage.isFileReadable(file))) {
        logger.error(`File is not readable: ${file}.`);
        throw new ConfigError(`File is not readable: ${file}.`);
    }
    logger.info(`File is readable: ${file}.`);
    return;
}

const REQUIRED_FIELDS: Field[] = [
    {
        name: 'output directory',
        variable: 'outputDirectory',
        default: DEFAULT_DESTINATION_DIR,
        validations: [isDirectoryWriteable]
    },
    {
        name: 'output structure',
        variable: 'outputStructure',
        default: DEFAULT_OUTPUT_STRUCTURE,
    },
    {
        name: 'filename options',
        variable: 'filenameOptions',
        default: DEFAULT_FILENAME_OPTIONS
    },
    {
        name: 'credentials file',
        variable: 'credentialsFile',
        default: DEFAULT_CREDENTIALS_FILE,
        validations: [isFileReadable]
    },
    {
        name: 'token file',
        variable: 'tokenFile',
        default: DEFAULT_TOKEN_FILE,
    },
    {
        name: 'API scopes',
        variable: 'apiScopes',
        default: DEFAULT_SCOPES,
    }
];

// Default configuration
const DEFAULT: Partial<Config> = {
    filters: {
        exclude: {},
        include: {}
    }
};

export const createConfig = async (params: InputParameters): Promise<Config> => {
    const logger = getLogger();
    let config: Partial<Config> = { ...DEFAULT };
    const storage = Storage.create({ log: getLogger().debug });

    if (params.configFile) {
        const configFile = await storage.readFile(params.configFile, DEFAULT_CHARACTER_ENCODING);
        const fileConfig = yaml.load(configFile);
        config = deepMerge(config, fileConfig) as Config;
    }

    // Create array of config checks to perform
    logger.info('Checking for conflicts');
    await checkForConflicts(params, config);

    // Override config with any provided command line arguments
    logger.info('Overriding config with command line arguments');
    await overrideWithParamValues(params, config);

    // Set default values for any missing required fields
    logger.info('Setting default values for missing required fields');
    await setDefaultsForMissing(config);

    try {
        // Validate that all required fields are present as cast to Config
        const validatedConfig = await validateRequiredFields(config);
        return validatedConfig;
    } catch (error) {
        logger.error(`Error validating required fields: ${error}`);
        throw error;
    }
}

export async function setDefaultsForMissing(config: Partial<Config>) {
    // Use REQUIRED_FIELDS for defaults in a type-safe way
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        const key = field.variable as keyof Config;
        if (config[key] === undefined) {
            config[key] = field.default;
        }
    }));
    return config;
}

export async function overrideWithParamValues(params: InputParameters, config: Partial<Config>) {
    // Use REQUIRED_FIELDS to set overrides from params
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        const configKey = field.variable as keyof Config;
        const paramKey = field.variable as keyof Input;
        const paramValue = (params as any)[paramKey];

        if (paramValue !== undefined) {
            config[configKey] = paramValue;
        }
    }));
    return config;
}

export async function checkForConflicts(params: InputParameters, config: Partial<Config>) {
    // Use REQUIRED_FIELDS for conflict checks
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        const paramValue = (params as any)[field.variable as keyof Input];
        const configValue = config[field.variable as keyof Config];

        checkConfigConflict(
            field.name,
            paramValue,
            configValue
        );
    }));
    return config;
}

export async function validateRequiredFields(config: Partial<Config>): Promise<Config> {
    const logger = getLogger();
    const missingFields = REQUIRED_FIELDS.filter(field => config[field.variable as keyof Config] === undefined);
    if (missingFields.length > 0) {
        throw new ConfigError(`Missing required fields: ${missingFields.map(f => f.variable).join(', ')}.  This field muust be set either in a configuration file or through a command-line argument.`);
    }
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        if (field.validations) {
            await Promise.all(field.validations.map(async validation => {
                await validation(field, config);
                return;
            }));
            return;
        } else {
            return;
        }
    }));
    logger.info('Validation complete');
    return config as Config;
}

/**
 * Helper function to check for conflicts between command line arguments and config file settings
 * @param settingName The name of the setting being checked
 * @param cmdLineValue The value from command line arguments
 * @param configValue The value from the config file
 * @param customMessageFn Optional function to generate a custom error message for the specific values
 */
function checkConfigConflict<T>(
    settingName: string,
    cmdLineValue: T,
    configValue: T | undefined
) {
    if (cmdLineValue && configValue) {
        const logger = getLogger();
        const conflictMessage = `Command line ${settingName}: ${cmdLineValue ? cmdLineValue.toString() : 'not set'}\n    Config file ${settingName}: ${configValue ? configValue.toString() : 'not set'}`;

        logger.error(`${settingName.charAt(0).toUpperCase() + settingName.slice(1)} conflict detected:
    ${conflictMessage}
            
${settingName.charAt(0).toUpperCase() + settingName.slice(1)} can only be set in one place - either via command line argument or in the config file, not both.`);
        throw new ConfigError(`Conflicting ${settingName} settings detected in command line and config file. You can only set this in one place - either via command line argument or in the config file, not both. The setting was present in both locations.`);
    }
}