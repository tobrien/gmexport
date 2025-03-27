import { deepMerge } from '../../src/util/general';

describe('deepMerge', () => {
    test('should merge two flat objects', () => {
        const target = { a: 1, b: 2 };
        const source = { b: 3, c: 4 };
        const result = deepMerge(target, source);

        expect(result).toEqual({ a: 1, b: 3, c: 4 });
        expect(result).toBe(target); // should modify the target object
    });

    test('should recursively merge nested objects', () => {
        const target = { a: 1, b: { x: 1, y: 2 } };
        const source = { b: { y: 3, z: 4 }, c: 5 };
        const result = deepMerge(target, source);

        expect(result).toEqual({
            a: 1,
            b: { x: 1, y: 3, z: 4 },
            c: 5
        });
        expect(result).toBe(target);
    });

    test('should handle nested objects with missing properties in target', () => {
        const target = { a: 1 };
        const source = { b: { x: 1, y: 2 } };
        const result = deepMerge(target, source);

        expect(result).toEqual({ a: 1, b: { x: 1, y: 2 } });
        expect(result.b).toEqual({ x: 1, y: 2 });
    });

    test('should replace arrays (not merge them)', () => {
        const target = { a: [1, 2, 3], b: 2 };
        const source = { a: [4, 5], c: 3 };
        const result = deepMerge(target, source);

        expect(result).toEqual({ a: [4, 5], b: 2, c: 3 });
        expect(result.a).toBe(source.a); // Array reference should be replaced
    });

    test('should handle null and undefined values', () => {
        const target = { a: 1, b: null, c: undefined };
        const source = { a: null, b: 2, d: undefined };
        const result = deepMerge(target, source);

        expect(result).toEqual({ a: null, b: 2, c: undefined, d: undefined });
    });

    test('should handle empty objects', () => {
        const target = {};
        const source = {};
        const result = deepMerge(target, source);

        expect(result).toEqual({});
        expect(result).toBe(target);
    });

    test('should handle complex nested structures', () => {
        const target = {
            config: {
                api: {
                    endpoint: 'https://old-api.com',
                    version: 'v1',
                    settings: {
                        timeout: 1000
                    }
                }
            },
            data: [1, 2, 3]
        };

        const source = {
            config: {
                api: {
                    endpoint: 'https://new-api.com',
                    settings: {
                        timeout: 2000,
                        retry: true
                    }
                },
                newSetting: true
            },
            data: [4, 5]
        };

        const result = deepMerge(target, source);

        expect(result).toEqual({
            config: {
                api: {
                    endpoint: 'https://new-api.com',
                    version: 'v1',
                    settings: {
                        timeout: 2000,
                        retry: true
                    }
                },
                newSetting: true
            },
            data: [4, 5]
        });
    });
});
