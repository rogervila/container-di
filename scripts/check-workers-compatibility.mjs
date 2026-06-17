import { existsSync, readFileSync } from 'node:fs';

const packageUrl = new URL('../package.json', import.meta.url);
const sourceUrl = new URL('../src/container-di.ts', import.meta.url);
const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
const exportEntry = packageJson.exports?.['.'];

if (exportEntry === undefined) {
    throw new Error('Package must define exports["."].');
}

const importPath = exportEntry.import;
const typesPath = exportEntry.types ?? packageJson.types;

if (typeof importPath !== 'string') {
    throw new Error('Package ESM export must be a string path.');
}

if (typeof typesPath !== 'string') {
    throw new Error('Package types export must be a string path.');
}

const bundleUrl = new URL(`../${importPath}`, import.meta.url);
const typesUrl = new URL(`../${typesPath}`, import.meta.url);

if (!existsSync(bundleUrl)) {
    throw new Error(`Missing ESM bundle at ${importPath}.`);
}

if (!existsSync(typesUrl)) {
    throw new Error(`Missing TypeScript declarations at ${typesPath}.`);
}

const forbiddenRuntimePatterns = [
    [/\bfrom\s+['"](?:node:|fs|path|process|crypto|buffer|stream|http|https|url)/, 'Node-only import'],
    [/\brequire\s*\(/, 'CommonJS require'],
    [/\bprocess\./, 'process global'],
    [/\bBuffer\b/, 'Buffer global'],
    [/\b__dirname\b|\b__filename\b/, 'CommonJS path global'],
];

for (const [url, label] of [
    [sourceUrl, 'source'],
    [bundleUrl, 'ESM bundle'],
]) {
    const contents = readFileSync(url, 'utf8');

    for (const [pattern, description] of forbiddenRuntimePatterns) {
        if (pattern.test(contents)) {
            throw new Error(`${label} contains ${description}: ${pattern}`);
        }
    }
}

const module = await import(bundleUrl.href);
const container = module.Container.make();

container.instance('value', 1);

if (container.get('value') !== 1) {
    throw new Error('ESM bundle failed a basic Worker-compatible container resolution check.');
}
