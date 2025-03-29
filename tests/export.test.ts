import { jest } from '@jest/globals';
import * as GmailApi from '../src/gmail/api.js';
import * as GmailExport from '../src/gmailExport.js';
import { getLogger } from '../src/logging.js';
import { Configuration } from '../src/types';

jest.mock('../src/logging.js');

describe('printExportSummary', () => {
    const mockLogger = {
        info: jest.fn()
    };

    const mockConfig: Configuration = {
        export: {
            dry_run: false
        }
    } as Configuration;

    const mockApi: GmailApi.Instance = {
        listMessages: jest.fn() as jest.MockedFunction<GmailApi.Instance['listMessages']>,
        listLabels: jest.fn() as jest.MockedFunction<GmailApi.Instance['listLabels']>,
        getMessage: jest.fn() as jest.MockedFunction<GmailApi.Instance['getMessage']>,
        getAttachment: jest.fn() as jest.MockedFunction<GmailApi.Instance['getAttachment']>
    };

    let gmailExport: GmailExport.Instance;

    beforeEach(() => {
        jest.clearAllMocks();
        (getLogger as jest.Mock).mockReturnValue(mockLogger);
        gmailExport = GmailExport.create(mockConfig, mockApi);
    });

    it('should print export summary with correct format and values', () => {
        const messages = new Array(10);
        const processedCount = 7;
        const skippedCount = 2;
        const filteredCount = 1;
        const attachmentCount = 3;
        gmailExport.printExportSummary(messages, processedCount, skippedCount, filteredCount, attachmentCount, false);

        expect(mockLogger.info).toHaveBeenCalledWith('Export Summary:');
        expect(mockLogger.info).toHaveBeenCalledWith('\tTotal messages found: 10');
        expect(mockLogger.info).toHaveBeenCalledWith('\tSuccessfully processed: 7');
        expect(mockLogger.info).toHaveBeenCalledWith('\tSkipped (already exists): 2');
        expect(mockLogger.info).toHaveBeenCalledWith('\tFiltered out: 1');
        expect(mockLogger.info).toHaveBeenCalledWith('\tAttachments saved: 3');
        expect(mockLogger.info).toHaveBeenCalledWith('\tDry run mode: No');
    });

    it('should correctly indicate dry run mode when enabled', () => {
        const messages = new Array(5);

        gmailExport.printExportSummary(messages, 0, 0, 0, 0, true);

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('\tDry run mode: Yes'));
    });

});
