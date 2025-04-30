// eslint-disable-next-line no-restricted-imports
import * as fs from 'fs';

/**
 * This module exists to isolate filesystem operations from the rest of the codebase.
 * This makes testing easier by avoiding direct fs mocking in jest configuration.
 * 
 * Additionally, abstracting storage operations allows for future flexibility - 
 * this export utility may need to work with storage systems other than the local filesystem
 * (e.g. S3, Google Cloud Storage, etc).
 */

export interface Utility {
    exists: (path: string) => Promise<boolean>;
    isDirectory: (path: string) => Promise<boolean>;
    isFile: (path: string) => Promise<boolean>;
    isReadable: (path: string) => Promise<boolean>;
    isWritable: (path: string) => Promise<boolean>;
    isFileReadable: (path: string) => Promise<boolean>;
    isDirectoryReadable: (path: string) => Promise<boolean>;
    isDirectoryWritable: (path: string) => Promise<boolean>;
    createDirectory: (path: string) => Promise<void>;
    readFile: (path: string, encoding: string) => Promise<string>;
    writeFile: (path: string, data: string | Buffer, encoding: string) => Promise<void>;
}

export const create = (params: { log?: (message: string, ...args: any[]) => void }): Utility => {

    // eslint-disable-next-line no-console
    const log = params.log || console.log;

    const exists = async (path: string): Promise<boolean> => {
        try {
            await fs.promises.stat(path);
            return true;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error: any) {
            return false;
        }
    }

    const isDirectory = async (path: string): Promise<boolean> => {
        const stats = await fs.promises.stat(path);
        if (!stats.isDirectory()) {
            log(`${path} is not a directory`);
            return false;
        }
        return true;
    }

    const isFile = async (path: string): Promise<boolean> => {
        const stats = await fs.promises.stat(path);
        if (!stats.isFile()) {
            log(`${path} is not a file`);
            return false;
        }
        return true;
    }

    const isReadable = async (path: string): Promise<boolean> => {
        try {
            await fs.promises.access(path, fs.constants.R_OK);
        } catch (error: any) {
            log(`${path} is not readable: %s %s`, error.message, error.stack);
            return false;
        }
        return true;
    }

    const isWritable = async (path: string): Promise<boolean> => {
        try {
            await fs.promises.access(path, fs.constants.W_OK);
        } catch (error: any) {
            log(`${path} is not writable: %s %s`, error.message, error.stack);
            return false;
        }
        return true;
    }

    const isFileReadable = async (path: string): Promise<boolean> => {
        return await exists(path) && await isFile(path) && await isReadable(path);
    }

    const isDirectoryWritable = async (path: string): Promise<boolean> => {
        return await exists(path) && await isDirectory(path) && await isWritable(path);
    }

    const isDirectoryReadable = async (path: string): Promise<boolean> => {
        return await exists(path) && await isDirectory(path) && await isReadable(path);
    }

    const createDirectory = async (path: string): Promise<void> => {
        try {
            await fs.promises.mkdir(path, { recursive: true });
        } catch (mkdirError: any) {
            throw new Error(`Failed to create output directory ${path}: ${mkdirError.message} ${mkdirError.stack}`);
        }
    }

    const readFile = async (path: string, encoding: string): Promise<string> => {
        return await fs.promises.readFile(path, { encoding: encoding as BufferEncoding });
    }

    const writeFile = async (path: string, data: string | Buffer, encoding: string): Promise<void> => {
        await fs.promises.writeFile(path, data, { encoding: encoding as BufferEncoding });
    }

    return { exists, isDirectory, isFile, isReadable, isWritable, isFileReadable, isDirectoryReadable, isDirectoryWritable, createDirectory, readFile, writeFile };
}