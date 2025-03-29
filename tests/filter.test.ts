import { Configuration } from '../src/types';
import * as Filter from '../src/filter';
import { gmail_v1 } from 'googleapis';
import MessageWrapper from '../src/MessageWrapper';

describe('Filter', () => {
    let mockConfig: Configuration;
    let filter: ReturnType<typeof Filter.create>;

    beforeEach(() => {
        mockConfig = {
            credentials: {
                credentials_file: 'test.json',
                token_file: 'token.json'
            },
            export: {
                max_results: 1000,
                destination_dir: './test',
                start_date: '2024-01-01',
                end_date: '2024-01-31',
                dry_run: false,
                output_structure: 'year',
                timezone: 'UTC'
            },
            api: {
                scopes: ['test.scope']
            },
            filters: {
                include: {
                    labels: ['IMPORTANT'],
                    from: ['include@example.com'],
                    subject: ['include subject'],
                    to: ['include-to@example.com']
                },
                exclude: {
                    labels: ['SPAM'],
                    from: ['spam@example.com'],
                    subject: ['spam subject'],
                    to: ['spam-to@example.com']
                }
            }
        } as Configuration;

        filter = Filter.create(mockConfig);
    });

    describe('shouldSkipEmail', () => {
        it('should not skip email matching include patterns', () => {
            const email: gmail_v1.Schema$Message = {
                id: '123',
                labelIds: ['INBOX'],
                payload: {
                    headers: [
                        { name: 'From', value: 'include@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'test subject' },
                        { name: 'Date', value: new Date().toISOString() },
                        { name: 'Message-ID', value: '123' },
                    ]
                }
            };

            const result = filter.shouldSkipEmail(new MessageWrapper(email));
            expect(result.skip).toBe(false);
        });

        it('should skip email not matching any include patterns when includes are specified', () => {
            const email: gmail_v1.Schema$Message = {
                id: '123',
                labelIds: ['INBOX'],
                payload: {
                    headers: [
                        { name: 'From', value: 'other@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'test subject' },
                        { name: 'Date', value: new Date().toISOString() },
                        { name: 'Message-ID', value: '123' },
                    ]
                }
            };

            const result = filter.shouldSkipEmail(new MessageWrapper(email));
            expect(result.skip).toBe(true);
            expect(result.reason).toBe('No include patterns matched');
        });

        it('should skip email matching exclude patterns', () => {
            // Remove include filters to test exclude patterns
            mockConfig.filters.include = {};
            filter = Filter.create(mockConfig);

            const email: gmail_v1.Schema$Message = {
                id: '123',
                labelIds: ['INBOX'],
                payload: {
                    headers: [
                        { name: 'From', value: 'spam@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'test subject' },
                        { name: 'Date', value: new Date().toISOString() },
                        { name: 'Message-ID', value: '123' },
                    ]
                }
            };

            const result = filter.shouldSkipEmail(new MessageWrapper(email));
            expect(result.skip).toBe(true);
            expect(result.reason).toBe('Skipped sender pattern');
        });

        it('should skip email with excluded label', () => {
            mockConfig.filters.include = {};
            filter = Filter.create(mockConfig);

            const email: gmail_v1.Schema$Message = {
                id: '123',
                labelIds: ['SPAM'],
                payload: {
                    headers: [
                        { name: 'From', value: 'test@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'test subject' },
                        { name: 'Date', value: new Date().toISOString() },
                        { name: 'Message-ID', value: '123' },
                    ]
                }
            };

            const result = filter.shouldSkipEmail(new MessageWrapper(email));
            expect(result.skip).toBe(true);
            expect(result.reason).toBe('Skipped label');
        });

        it('should not skip email when no filters match', () => {
            mockConfig.filters.include = {};
            filter = Filter.create(mockConfig);

            const email: gmail_v1.Schema$Message = {
                id: '123',
                labelIds: ['INBOX'],
                payload: {
                    headers: [
                        { name: 'From', value: 'test@example.com' },
                        { name: 'To', value: 'test@example.com' },
                        { name: 'Subject', value: 'test subject' },
                        { name: 'Date', value: new Date().toISOString() },
                        { name: 'Message-ID', value: '123' },
                    ]
                }
            };

            const result = filter.shouldSkipEmail(new MessageWrapper(email));
            expect(result.skip).toBe(false);
        });

        it('should keep email matching include pattern regardless of exclude patterns', () => {
            const email: gmail_v1.Schema$Message = {
                id: '123',
                labelIds: ['SPAM'],
                payload: {
                    headers: [
                        { name: 'From', value: 'include@example.com' },
                        { name: 'To', value: 'spam-to@example.com' }, // Would normally be excluded
                        { name: 'Subject', value: 'test subject' },
                        { name: 'Date', value: new Date().toISOString() },
                        { name: 'Message-ID', value: '123' },
                    ]
                }
            };

            const result = filter.shouldSkipEmail(new MessageWrapper(email));
            expect(result.skip).toBe(false);
        });
    });
});
