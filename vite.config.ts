// @ts-expect-error ts(2307)
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            // @ts-expect-error ts(2304)
            entry: resolve(__dirname, 'src/container-di.ts'),
            name: 'container-di',
            fileName: 'container-di',
        },
    },
    plugins: [dts()],
});
