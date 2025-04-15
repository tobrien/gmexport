import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';
import replace from '@rollup/plugin-replace';
// import { visualizer } from 'rollup-plugin-visualizer';
import { execSync } from 'child_process';
import shebang from 'rollup-plugin-preserve-shebang';

const gitInfo = {
    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
    commit: execSync('git rev-parse --short HEAD').toString().trim(),
    tags: '',
    commitDate: execSync('git log -1 --format=%cd --date=iso').toString().trim(),
};

try {
    gitInfo.tags = execSync('git tag --points-at HEAD | paste -sd "," -').toString().trim();
} catch {
    gitInfo.tags = '';
}


export default defineConfig({
    server: {
        port: 3000
    },
    plugins: [
        ...VitePluginNode({
            adapter: 'node',
            appPath: './src/main.ts',
            exportName: 'viteNodeApp',
            tsCompiler: 'swc',
        }),
        // visualizer({
        //     template: 'network',
        //     filename: 'network.html',
        //     projectRoot: process.cwd(),
        // }),
        replace({
            '__VERSION__': process.env.npm_package_version,
            '__GIT_BRANCH__': gitInfo.branch,
            '__GIT_COMMIT__': gitInfo.commit,
            '__GIT_TAGS__': gitInfo.tags === '' ? '' : `T:${gitInfo.tags}`,
            '__GIT_COMMIT_DATE__': gitInfo.commitDate,
            '__SYSTEM_INFO__': `${process.platform} ${process.arch} ${process.version}`,
        }),
    ],
    build: {
        target: 'esnext',
        outDir: 'dist',
        rollupOptions: {
            input: 'src/main.ts',
            output: {
                format: 'es',
                entryFileNames: '[name].js',
                preserveModules: true,
                validate: true,
            },
            plugins: [
                shebang({
                    header: '#!/usr/bin/env node',
                }),
            ],
        },
    },
}); 