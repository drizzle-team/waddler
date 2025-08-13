import { globSync } from 'glob';
import { defineConfig } from 'tsup';

const entries = globSync('src/**/*.ts');

export default defineConfig({
	entry: [...entries, '!./src/dev'],
	outDir: 'dist.new',
	format: ['cjs', 'esm'],
	bundle: false,
	splitting: false,
	sourcemap: true,
	dts: true,
	outExtension({ format }) {
		return format === 'cjs'
			? { dts: '.d.cts', js: '.cjs' }
			: { dts: '.d.ts', js: '.js' };
		// return {
		// 	js: format === 'cjs' ? '.cjs' : '.js',
		// };
	},
	tsconfig: 'tsconfig.json',
});
