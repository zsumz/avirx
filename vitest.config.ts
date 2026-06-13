import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            avirx: new URL('./src/index.ts', import.meta.url).pathname,
        },
    },
    test: {
        coverage: {
            exclude: [
                'examples/**',
                'tests/**',
                'src/internals/model.ts',
                'src/index.ts',
                'src/types.ts',
                'src/types/**',
            ],
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            reportsDirectory: 'coverage',
            thresholds: {
                branches: 90,
                functions: 98,
                lines: 94,
                statements: 94,
            },
        },
        include: ['tests/**/*.test.ts'],
    },
});
