import { FilenameOption, OutputStructure } from "./export.d";

export const VERSION = '__VERSION__ (__GIT_BRANCH__/__GIT_COMMIT__ __GIT_TAGS__ __GIT_COMMIT_DATE__) __SYSTEM_INFO__';
export const PROGRAM_NAME = 'gmexport';
export const DEFAULT_CHARACTER_ENCODING = 'utf-8';
export const DEFAULT_BINARY_TO_TEXT_ENCODING = 'base64';
export const DEFAULT_DESTINATION_DIR = './exports';
export const DATE_FORMAT_MONTH_DAY = 'MM-DD';
export const DATE_FORMAT_YEAR = 'YYYY';
export const DATE_FORMAT_YEAR_MONTH = 'YYYY-MM';
export const DATE_FORMAT_YEAR_MONTH_DAY = 'YYYY-MM-DD';
export const DATE_FORMAT_YEAR_MONTH_DAY_SLASH = 'YYYY/MM/DD';
export const DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES = 'YYYY-MM-DD-HHmm';
export const DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS = 'YYYY-MM-DD-HHmmss';
export const DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS_MILLISECONDS = 'YYYY-MM-DD-HHmmss.SSS';
export const DATE_FORMAT_MONTH = 'MM';
export const DATE_FORMAT_DAY = 'DD';
export const DATE_FORMAT_HOURS = 'HHmm';
export const DATE_FORMAT_MINUTES = 'mm';
export const DATE_FORMAT_SECONDS = 'ss';
export const DATE_FORMAT_MILLISECONDS = 'SSS';
export const DEFAULT_TIMEZONE = 'Etc/UTC';
export const DEFAULT_CREDENTIALS_FILE = './credentials.json';
export const DEFAULT_TOKEN_FILE = './token.json';
export const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
export const DEFAULT_OUTPUT_STRUCTURE = 'month' as OutputStructure;
export const DEFAULT_FILENAME_OPTIONS = ['date', 'subject'] as FilenameOption[];
export const DEFAULT_VERBOSE = false;
export const DEFAULT_DRY_RUN = false;
export const DEFAULT_CURRENT_MONTH = false;

export const ALLOWED_SCOPES = [
    'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
    'https://www.googleapis.com/auth/gmail.addons.current.message.action',
    'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
    'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.insert',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.metadata',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/gmail.settings.sharing',
    'https://mail.google.com/'
];

export const ALLOWED_OUTPUT_STRUCTURES = ['none', 'year', 'month', 'day'] as OutputStructure[];
export const ALLOWED_FILENAME_OPTIONS = ['date', 'time', 'subject'] as FilenameOption[];