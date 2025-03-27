import { Config } from '../src/config';
import * as Filter from '../src/filter';
import { Email } from '../src/gmail';

describe('Filter', () => {
    let mockConfig: Config;
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
                dry_run: false
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
        } as Config;

        filter = Filter.create(mockConfig);
    });

    describe('shouldSkipEmail', () => {
        it('should not skip email matching include patterns', () => {
            const email: Email = {
                id: '123',
                from: 'include@example.com',
                to: 'test@example.com',
                subject: 'test subject',
                date: new Date().toISOString(),
                labels: ['INBOX'],
            };

            const result = filter.shouldSkipEmail(email);
            expect(result.skip).toBe(false);
        });

        it('should skip email not matching any include patterns when includes are specified', () => {
            const email: Email = {
                id: '123',
                from: 'other@example.com',
                to: 'test@example.com',
                subject: 'test subject',
                date: new Date().toISOString(),
                labels: ['INBOX'],
            };

            const result = filter.shouldSkipEmail(email);
            expect(result.skip).toBe(true);
            expect(result.reason).toBe('No include patterns matched');
        });

        it('should skip email matching exclude patterns', () => {
            // Remove include filters to test exclude patterns
            mockConfig.filters.include = {};
            filter = Filter.create(mockConfig);

            const email: Email = {
                id: '123',
                from: 'spam@example.com',
                to: 'test@example.com',
                subject: 'test subject',
                date: new Date().toISOString(),
                labels: ['INBOX'],
            };

            const result = filter.shouldSkipEmail(email);
            expect(result.skip).toBe(true);
            expect(result.reason).toBe('Skipped sender pattern');
        });

        it('should skip email with excluded label', () => {
            mockConfig.filters.include = {};
            filter = Filter.create(mockConfig);

            const email: Email = {
                id: '123',
                from: 'test@example.com',
                to: 'test@example.com',
                subject: 'test subject',
                date: new Date().toISOString(),
                labels: ['SPAM'],
            };

            const result = filter.shouldSkipEmail(email);
            expect(result.skip).toBe(true);
            expect(result.reason).toBe('Skipped label');
        });

        it('should not skip email when no filters match', () => {
            mockConfig.filters.include = {};
            filter = Filter.create(mockConfig);

            const email: Email = {
                id: '123',
                from: 'test@example.com',
                to: 'test@example.com',
                subject: 'test subject',
                date: new Date().toISOString(),
                labels: ['INBOX'],
            };

            const result = filter.shouldSkipEmail(email);
            expect(result.skip).toBe(false);
        });

        it('should keep email matching include pattern regardless of exclude patterns', () => {
            const email: Email = {
                id: '123',
                from: 'include@example.com',
                to: 'spam-to@example.com', // Would normally be excluded
                subject: 'test subject',
                date: new Date().toISOString(),
                labels: ['SPAM'], // Would normally be excluded
            };

            const result = filter.shouldSkipEmail(email);
            expect(result.skip).toBe(false);
        });
    });
});
