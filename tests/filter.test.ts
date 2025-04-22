import { Config as RunConfig } from '../src/run.js';
import * as Filter from '../src/filter.js';
import MessageWrapper from '../src/gmail/MessageWrapper.js';
import { OutputStructure, FilenameOption } from '@tobrien/cabazooka';

describe('filter', () => {
    let config: RunConfig;
    let message: MessageWrapper;

    beforeEach(() => {
        config = {
            outputDirectory: '',
            outputStructure: 'year' as OutputStructure,
            outputFilenameOptions: ['date' as FilenameOption],
            credentialsFile: '',
            tokenFile: '',
            apiScopes: [],
            filters: {
                exclude: {},
                include: {}
            },
            dateRange: { start: new Date(), end: new Date() },
            dryRun: false,
            verbose: false,
            timezone: 'UTC',
        };

        message = {
            from: 'test@example.com',
            to: 'recipient@example.com',
            subject: 'Test Subject',
            raw: {
                labelIds: ['Label_1', 'Label_2']
            }
        } as MessageWrapper;
    });

    describe('shouldSkipEmail', () => {
        it('should not skip when no filters are defined', () => {
            const filter = Filter.create(config);
            const result = filter.shouldSkipEmail(message);
            expect(result.skip).toBe(false);
        });

        describe('inclusive filters', () => {
            it('should skip when inclusive filters exist but no match', () => {
                config.filters!.include = {
                    from: ['different@example.com']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(true);
                expect(result.reason).toBe('No include patterns matched');
            });

            it('should not skip when from pattern matches', () => {
                config.filters!.include = {
                    from: ['test@example.com']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(false);
            });

            it('should not skip when subject pattern matches', () => {
                config.filters!.include = {
                    subject: ['Test']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(false);
            });

            it('should not skip when to pattern matches', () => {
                config.filters!.include = {
                    to: ['recipient@example.com']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(false);
            });

            it('should not skip when label matches', () => {
                config.filters!.include = {
                    labels: ['Label_1']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(false);
            });
        });

        describe('exclusive filters', () => {
            it('should skip when from pattern matches', () => {
                config.filters!.exclude = {
                    from: ['test@example.com']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(true);
                expect(result.reason).toBe('Skipped sender pattern');
            });

            it('should skip when subject pattern matches', () => {
                config.filters!.exclude = {
                    subject: ['Test']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(true);
                expect(result.reason).toBe('Skipped subject pattern');
            });

            it('should skip when to pattern matches', () => {
                config.filters!.exclude = {
                    to: ['recipient@example.com']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(true);
                expect(result.reason).toBe('Skipped recipient pattern');
            });

            it('should skip when label matches', () => {
                config.filters!.exclude = {
                    labels: ['Label_1']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(true);
                expect(result.reason).toBe('Skipped label');
            });

            it('should not skip when no patterns match', () => {
                config.filters!.exclude = {
                    from: ['other@example.com'],
                    subject: ['Other'],
                    to: ['other@example.com'],
                    labels: ['Label_3']
                };
                const filter = Filter.create(config);
                const result = filter.shouldSkipEmail(message);
                expect(result.skip).toBe(false);
            });
        });
    });
});
