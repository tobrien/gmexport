import { jest } from '@jest/globals';
import { Command } from 'commander';

// Import necessary modules for the remaining tests
import * as Arguments from '../src/arguments.js';
import { Cabazooka } from '@tobrien/cabazooka'; // Keep Cabazooka for mocking

// No need for storage or other mocks if only testing commander setup

describe('arguments', () => {
    let program: Command;
    let mockCabazooka: jest.Mocked<Cabazooka>; // Keep type for clarity if possible

    beforeEach(async () => { // Mark as async
        jest.clearAllMocks();

        // Mock Cabazooka - Using 'as any' as we only need configure for this test scope
        mockCabazooka = {
            configure: jest.fn().mockImplementation(async (prog) => prog),
            // Add other methods if needed, or rely on 'as any'
        } as any; // Using as any to simplify mock for this test

        program = new Command();
        // Call the actual configure function from the imported module
        await Arguments.configure(program, mockCabazooka);
    });

    describe('configure', () => {
        it('should configure program name, summary, description', () => {
            expect(program.name()).toBeDefined(); // Check if name is set
            expect(program.summary()).toBeDefined();
            expect(program.description()).toBeDefined();
        });

        it('should define all expected options', () => {
            const optionNames = program.options.map(opt => opt.long);
            expect(optionNames).toContain('--start');
            expect(optionNames).toContain('--end');
            expect(optionNames).toContain('--current-month');
            expect(optionNames).toContain('--dry-run');
            expect(optionNames).toContain('--verbose');
            expect(optionNames).toContain('--config');
            expect(optionNames).toContain('--credentials-file');
            expect(optionNames).toContain('--token-file');
            expect(optionNames).toContain('--api-scopes');
        });

        it('should call cabazooka.configure', () => {
            // Check if the mocked configure was called
            expect(mockCabazooka.configure).toHaveBeenCalledWith(program);
        });

        it('should set the program version', () => {
            // program.version() is called internally, check if _version is set
            expect((program as any)._version).toBeDefined();
        });
    });

    // --- REMOVED ALL OBSOLETE DESCRIBE BLOCKS --- 
});
