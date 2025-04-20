import * as Dates from "./util/dates";
import * as yaml from 'js-yaml';
import * as Storage from './util/storage';
import { getLogger } from './logging';
import { deepMerge } from './util/general';
import { Input } from './arguments';
import { DEFAULT_CHARACTER_ENCODING, DEFAULT_CREDENTIALS_FILE, DEFAULT_DESTINATION_DIR, DEFAULT_FILENAME_OPTIONS, DEFAULT_OUTPUT_STRUCTURE, DEFAULT_SCOPES, DEFAULT_TOKEN_FILE, ALLOWED_SCOPES } from './constants';
import { FilenameOption, OutputStructure } from "@tobrien/cabazooka"; // Assuming this is the correct path

export interface DateRange {
    start: Date;
    end: Date;
}

export interface MessageFilter {
    labels?: string[];
    from?: string[];
    to?: string[];
    subject?: string[];
}

export interface Config {
    dateRange: DateRange;
    dryRun: boolean;
    verbose: boolean;
    timezone: string;
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

export type InputParameters = Omit<Input, 'start' | 'end'> & {
    configFile?: string;
    start?: Date;
    end?: Date;
    currentMonth?: boolean;
};

type Field = {
    name: string;
    variable: keyof Config | keyof InputParameters;
    default: any;
    validations?: FieldValidation[];
};

type FieldValidation = (field: Field, config: Partial<Config>) => Promise<void>;

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
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

const isValidApiScope: FieldValidation = async (field, config) => {
    const scopes = config[field.variable as keyof Config] as string[];
    if (scopes) {
        if (scopes.length === 0) {
            throw new ConfigError('API scopes cannot be empty. Please provide at least one scope.');
        }
        for (const scope of scopes) {
            if (!ALLOWED_SCOPES.includes(scope)) {
                throw new ConfigError(`Invalid API scope: ${scope}. Valid scopes are: ${ALLOWED_SCOPES.join(', ')}`);
            }
        }
    }
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
        validations: [isValidApiScope]
    },
    {
        name: 'timezone',
        variable: 'timezone',
        default: 'UTC',
    },
    {
        name: 'dry run',
        variable: 'dryRun',
        default: false,
    },
    {
        name: 'verbose',
        variable: 'verbose',
        default: false,
    }
];

const DEFAULT: Partial<Config> = {
    filters: {
        exclude: {},
        include: {}
    }
};

export const createConfig = async (params: InputParameters): Promise<Config> => {
    const logger = getLogger();
    let config: Partial<Config> = { ...DEFAULT };
    const storage = Storage.create({ log: logger.debug });

    if (params.configFile) {
        try {
            logger.info(`Loading configuration from file: ${params.configFile}`);
            const configFileContent = await storage.readFile(params.configFile, DEFAULT_CHARACTER_ENCODING);
            const fileConfig = yaml.load(configFileContent);
            config = deepMerge(config, fileConfig);
            logger.info(`Configuration loaded successfully from ${params.configFile}`);
        } catch (error: any) {
            logger.error(`Failed to load or parse configuration file ${params.configFile}: ${error.message}`);
            throw new ConfigError(`Failed to load or parse configuration file ${params.configFile}: ${error.message}`);
        }
    } else {
        logger.info('No configuration file specified, using defaults and command-line arguments.');
    }

    logger.info('Checking for conflicts between command-line arguments and configuration file settings.');
    await checkForConflicts(params, config);

    logger.info('Applying command-line arguments over configuration file settings.');
    await overrideWithParamValues(params, config);

    logger.info('Ensuring all required fields have values, applying defaults if necessary.');
    await setDefaultsForMissing(config);

    const dateRange = createDateRange({
        timezone: config.timezone!,
        currentMonth: params.currentMonth ?? false,
        start: params.start,
        end: params.end,
    });
    config.dateRange = dateRange;

    logger.info('Performing final validation on the configuration.');
    try {
        const validatedConfig = await validateRequiredFields(config);
        logger.info('Configuration successfully created and validated.');
        return validatedConfig;
    } catch (error) {
        logger.error(`Configuration validation failed: ${error}`);
        throw error;
    }
}

function createDateRange({ timezone, currentMonth, start, end }: { timezone: string, currentMonth: boolean, start?: Date, end?: Date }): DateRange {
    let startDate: Date;
    let endDate: Date;

    const dateUtility = Dates.create({ timezone });

    if (currentMonth) {
        const today = dateUtility.now();
        startDate = dateUtility.startOfMonth(today);
        endDate = today;
        getLogger().info(`Using current month date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
        if (end) {
            endDate = dateUtility.date(end);
        } else {
            endDate = dateUtility.now();
            getLogger().info('No end date specified, defaulting to now.');
        }

        if (start) {
            startDate = dateUtility.date(start);
        } else {
            startDate = dateUtility.subDays(endDate, 31);
            getLogger().info('No start date specified, defaulting to 31 days before end date.');
        }
        getLogger().info(`Using specified or default date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }

    if (dateUtility.isBefore(endDate, startDate)) {
        const errorMsg = `End date (${endDate.toISOString()}) must be on or after start date (${startDate.toISOString()}).`;
        getLogger().error(errorMsg);
        throw new ConfigError(errorMsg);
    }

    return {
        start: startDate,
        end: endDate
    };
}

export async function setDefaultsForMissing(config: Partial<Config>) {
    const logger = getLogger();
    let changesMade = false;
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        const key = field.variable as keyof Config;
        if (config[key] === undefined) {
            logger.debug(`Setting default value for ${field.name}: ${field.default}`);
            config[key] = field.default;
            changesMade = true;
        }
    }));
    if (!changesMade) {
        logger.debug('No missing fields required defaults.');
    }
}

export async function overrideWithParamValues(params: InputParameters, config: Partial<Config>) {
    const logger = getLogger();
    let changesMade = false;
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        const paramKey = field.variable as keyof InputParameters;
        const configKey = field.variable as keyof Config;

        const paramValue = (params as any)[paramKey];

        if (paramValue !== undefined && config[configKey] !== paramValue) {
            const valueToLog = (field.name.includes('token') || field.name.includes('credentials')) ? '***' : paramValue;
            logger.info(`Overriding ${field.name} with command-line value: ${valueToLog}`);
            config[configKey] = paramValue;
            changesMade = true;
        }
    }));
    if (!changesMade) {
        logger.debug('No configuration values were overridden by command-line parameters.');
    }
}

export async function checkForConflicts(params: InputParameters, configFromFile: Partial<Config>) {
    const logger = getLogger();
    await Promise.all(REQUIRED_FIELDS.map(async field => {
        const paramKey = field.variable as keyof InputParameters;
        const configKey = field.variable as keyof Config;

        const paramValue = (params as any)[paramKey];
        const configValue = configFromFile[configKey];

        if (paramValue !== undefined && configValue !== undefined) {
            checkConfigConflict(
                field.name,
                paramValue,
                configValue
            );
        }
    }));
}

export async function validateRequiredFields(config: Partial<Config>): Promise<Config> {
    const logger = getLogger();
    const missingFields = REQUIRED_FIELDS.filter(field => {
        const key = field.variable as keyof Config;
        return config[key] === undefined;
    });

    if (missingFields.length > 0) {
        const missingFieldNames = missingFields.map(f => f.name).join(', ');
        const errorMsg = `Missing required configuration fields: ${missingFieldNames}. These must be set either via command-line arguments or in a configuration file.`;
        logger.error(errorMsg);
        throw new ConfigError(errorMsg);
    }

    logger.debug('All required fields are present. Proceeding with specific validations.');

    await Promise.all(REQUIRED_FIELDS.map(async field => {
        if (field.validations) {
            await Promise.all(field.validations.map(async validation => {
                await validation(field, config);
            }));
        }
    }));

    logger.info('Field-specific validations complete.');
    return config as Config;
}

function checkConfigConflict<T>(
    settingName: string,
    cmdLineValue: T,
    configValue: T | undefined
) {
    if (cmdLineValue !== undefined && configValue !== undefined) {
        const logger = getLogger();
        const cmdLog = (settingName.includes('token') || settingName.includes('credentials')) ? '***' : cmdLineValue;
        const cfgLog = (settingName.includes('token') || settingName.includes('credentials')) ? '***' : configValue;

        const conflictMessage = `Command line '${settingName}': ${cmdLog}
    Config file '${settingName}': ${cfgLog}`;

        logger.error(`${settingName.charAt(0).toUpperCase() + settingName.slice(1)} conflict detected:
    ${conflictMessage}

'${settingName}' can only be set in one place - either via command line argument or in the config file, not both.`);
        throw new ConfigError(`Conflicting settings for '${settingName}' detected. It must be set either via a command-line argument or in the config file, but not both.`);
    }
}