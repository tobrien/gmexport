import { jest } from '@jest/globals';
import * as fs from 'fs';

// Mock the fs module
const mockStat = jest.fn<() => Promise<fs.Stats>>();
const mockAccess = jest.fn<() => Promise<void>>();
const mockMkdir = jest.fn<() => Promise<void>>();
const mockReadFile = jest.fn<() => Promise<string>>();
const mockWriteFile = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('fs', () => ({
    __esModule: true,
    promises: {
        stat: mockStat,
        access: mockAccess,
        mkdir: mockMkdir,
        readFile: mockReadFile,
        writeFile: mockWriteFile
    },
    constants: {
        R_OK: 4,
        W_OK: 2
    }
}));

// Import the storage module after mocking fs
let storageModule: any;

describe('Storage Utility', () => {
    // Mock for console.log
    const mockLog = jest.fn();
    let storage: any;

    beforeAll(async () => {
        storageModule = await import('../../src/util/storage.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        storage = storageModule.create({ log: mockLog });
    });

    describe('exists', () => {
        it('should return true if path exists', async () => {
            mockStat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => false } as fs.Stats);

            const result = await storage.exists('/test/path');

            expect(result).toBe(true);
            expect(mockStat).toHaveBeenCalledWith('/test/path');
        });

        it('should return false if path does not exist', async () => {
            mockStat.mockRejectedValueOnce(new Error('Path does not exist'));

            const result = await storage.exists('/test/path');

            expect(result).toBe(false);
            expect(mockStat).toHaveBeenCalledWith('/test/path');
        });
    });

    describe('isDirectory', () => {
        it('should return true if path is a directory', async () => {
            mockStat.mockResolvedValueOnce({
                isDirectory: () => true,
                isFile: () => false
            } as fs.Stats);

            const result = await storage.isDirectory('/test/dir');

            expect(result).toBe(true);
            expect(mockStat).toHaveBeenCalledWith('/test/dir');
            expect(mockLog).not.toHaveBeenCalled();
        });

        it('should return false if path is not a directory', async () => {
            mockStat.mockResolvedValueOnce({
                isDirectory: () => false,
                isFile: () => true
            } as fs.Stats);

            const result = await storage.isDirectory('/test/file');

            expect(result).toBe(false);
            expect(mockStat).toHaveBeenCalledWith('/test/file');
            expect(mockLog).toHaveBeenCalledWith('/test/file is not a directory');
        });
    });

    describe('isFile', () => {
        it('should return true if path is a file', async () => {
            mockStat.mockResolvedValueOnce({
                isFile: () => true,
                isDirectory: () => false
            } as fs.Stats);

            const result = await storage.isFile('/test/file.txt');

            expect(result).toBe(true);
            expect(mockStat).toHaveBeenCalledWith('/test/file.txt');
            expect(mockLog).not.toHaveBeenCalled();
        });

        it('should return false if path is not a file', async () => {
            mockStat.mockResolvedValueOnce({
                isFile: () => false,
                isDirectory: () => true
            } as fs.Stats);

            const result = await storage.isFile('/test/dir');

            expect(result).toBe(false);
            expect(mockStat).toHaveBeenCalledWith('/test/dir');
            expect(mockLog).toHaveBeenCalledWith('/test/dir is not a file');
        });
    });

    describe('isReadable', () => {
        it('should return true if path is readable', async () => {
            mockAccess.mockResolvedValueOnce(undefined);

            const result = await storage.isReadable('/test/file.txt');

            expect(result).toBe(true);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 4);
        });

        it('should return false if path is not readable', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Not readable'));

            const result = await storage.isReadable('/test/file.txt');

            expect(result).toBe(false);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 4);
            expect(mockLog).toHaveBeenCalledWith(
                '/test/file.txt is not readable: %s %s',
                'Not readable',
                expect.any(String)
            );
        });
    });

    describe('isWritable', () => {
        it('should return true if path is writable', async () => {
            mockAccess.mockResolvedValueOnce(undefined);

            const result = await storage.isWritable('/test/file.txt');

            expect(result).toBe(true);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 2);
        });

        it('should return false if path is not writable', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Not writable'));

            const result = await storage.isWritable('/test/file.txt');

            expect(result).toBe(false);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 2);
            expect(mockLog).toHaveBeenCalledWith(
                '/test/file.txt is not writable: %s %s',
                'Not writable',
                expect.any(String)
            );
        });
    });

    describe('isFileReadable', () => {
        it('should return true if path exists, is a file, and is readable', async () => {
            // Setup mocks for the chain of function calls
            mockStat.mockResolvedValueOnce({ isFile: () => false, isDirectory: () => false } as fs.Stats); // exists
            mockStat.mockResolvedValueOnce({  // isFile
                isFile: () => true,
                isDirectory: () => false
            } as fs.Stats);
            mockAccess.mockResolvedValueOnce(undefined); // isReadable

            const result = await storage.isFileReadable('/test/file.txt');

            expect(result).toBe(true);
        });

        it('should return false if path does not exist', async () => {
            mockStat.mockRejectedValueOnce(new Error('Path does not exist'));

            const result = await storage.isFileReadable('/test/file.txt');

            expect(result).toBe(false);
        });

        it('should return false if path is not a file', async () => {
            mockStat.mockResolvedValueOnce({ isFile: () => false, isDirectory: () => false } as fs.Stats); // exists
            mockStat.mockResolvedValueOnce({ // isFile
                isFile: () => false,
                isDirectory: () => true
            } as fs.Stats);

            const result = await storage.isFileReadable('/test/dir');

            expect(result).toBe(false);
        });

        it('should return false if path is not readable', async () => {
            mockStat.mockResolvedValueOnce({ isFile: () => false, isDirectory: () => false } as fs.Stats); // exists
            mockStat.mockResolvedValueOnce({ // isFile
                isFile: () => true,
                isDirectory: () => false
            } as fs.Stats);
            mockAccess.mockRejectedValueOnce(new Error('Not readable')); // isReadable

            const result = await storage.isFileReadable('/test/file.txt');

            expect(result).toBe(false);
        });
    });

    describe('isDirectoryWritable', () => {
        it('should return true if path exists, is a directory, and is writable', async () => {
            // Setup mocks for the chain of function calls
            mockStat.mockResolvedValueOnce({ isFile: () => false, isDirectory: () => false } as fs.Stats); // exists
            mockStat.mockResolvedValueOnce({ // isDirectory
                isDirectory: () => true,
                isFile: () => false
            } as fs.Stats);
            mockAccess.mockResolvedValueOnce(undefined); // isWritable

            const result = await storage.isDirectoryWritable('/test/dir');

            expect(result).toBe(true);
        });

        it('should return false if path does not exist', async () => {
            mockStat.mockRejectedValueOnce(new Error('Path does not exist'));

            const result = await storage.isDirectoryWritable('/test/dir');

            expect(result).toBe(false);
        });

        it('should return false if path is not a directory', async () => {
            mockStat.mockResolvedValueOnce({ isFile: () => false, isDirectory: () => false } as fs.Stats); // exists
            mockStat.mockResolvedValueOnce({ // isDirectory
                isDirectory: () => false,
                isFile: () => true
            } as fs.Stats);

            const result = await storage.isDirectoryWritable('/test/file.txt');

            expect(result).toBe(false);
        });

        it('should return false if path is not writable', async () => {
            mockStat.mockResolvedValueOnce({ isFile: () => false, isDirectory: () => false } as fs.Stats); // exists
            mockStat.mockResolvedValueOnce({ // isDirectory
                isDirectory: () => true,
                isFile: () => false
            } as fs.Stats);
            mockAccess.mockRejectedValueOnce(new Error('Not writable')); // isWritable

            const result = await storage.isDirectoryWritable('/test/dir');

            expect(result).toBe(false);
        });
    });

    describe('createDirectory', () => {
        it('should create directory successfully', async () => {
            mockMkdir.mockResolvedValueOnce(undefined);

            await storage.createDirectory('/test/dir');

            expect(mockMkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
        });

        it('should throw error if directory creation fails', async () => {
            mockMkdir.mockRejectedValueOnce(new Error('Failed to create directory'));

            await expect(storage.createDirectory('/test/dir')).rejects.toThrow(
                'Failed to create output directory /test/dir: Failed to create directory'
            );
        });
    });

    describe('readFile', () => {
        it('should read file successfully', async () => {
            mockReadFile.mockResolvedValueOnce('file content');

            const result = await storage.readFile('/test/file.txt', 'utf8');

            expect(result).toBe('file content');
            expect(mockReadFile).toHaveBeenCalledWith('/test/file.txt', { encoding: 'utf8' });
        });
    });

    describe('writeFile', () => {
        it('should write file successfully', async () => {
            mockWriteFile.mockResolvedValueOnce(undefined);

            await storage.writeFile('/test/file.txt', 'file content', 'utf8');

            expect(mockWriteFile).toHaveBeenCalledWith('/test/file.txt', 'file content', { encoding: 'utf8' });
        });

        it('should write file with Buffer data', async () => {
            mockWriteFile.mockResolvedValueOnce(undefined);
            const buffer = Buffer.from('file content');

            await storage.writeFile('/test/file.txt', buffer, 'utf8');

            expect(mockWriteFile).toHaveBeenCalledWith('/test/file.txt', buffer, { encoding: 'utf8' });
        });
    });

    describe('Default logger', () => {
        it('should use console.log as default logger', async () => {
            const originalConsoleLog = console.log;
            const mockConsoleLog = jest.fn();
            console.log = mockConsoleLog;

            try {
                const utilWithDefaultLogger = storageModule.create({});
                mockStat.mockResolvedValueOnce({
                    isDirectory: () => false,
                    isFile: () => true
                } as fs.Stats);

                await utilWithDefaultLogger.isDirectory('/test/file');

                expect(mockConsoleLog).toHaveBeenCalledWith('/test/file is not a directory');
            } finally {
                console.log = originalConsoleLog;
            }
        });
    });
});
