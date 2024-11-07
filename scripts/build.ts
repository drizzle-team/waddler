import 'zx/globals';

import { build } from 'tsup';

fs.removeSync('dist');

await build({
	entry: ['src/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outExtension(ctx) {
		if (ctx.format === 'cjs') {
			return {
				dts: '.d.cts',
				js: '.cjs',
			};
		}
		return {
			dts: '.d.ts',
			js: '.js',
		};
	},
});

await build({
	entry: ['src/neo.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outExtension(ctx) {
		if (ctx.format === 'cjs') {
			return {
				dts: '.d.cts',
				js: '.cjs',
			};
		}
		return {
			dts: '.d.ts',
			js: '.js',
		};
	},
});

fs.copyFileSync('package.json', 'dist/package.json');
fs.copyFileSync('README.md', 'dist/README.md');
