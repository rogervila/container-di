import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: new URL('./src/container-di.ts', import.meta.url).pathname,
            name: 'container-di',
            fileName: 'container-di',
        },
    },
    plugins: [
        dts({
            entryRoot: 'src',
            exclude: ['src/**/*.test.ts'],
            beforeWriteFile: (filePath, content) => {
                if (filePath.endsWith('/src/container-di.d.ts')) {
                    return {
                        filePath: filePath.replace('/src/container-di.d.ts', '/container-di.d.ts'),
                        content,
                    };
                }

                return {
                    filePath,
                    content,
                };
            },
        }),
    ],
});
