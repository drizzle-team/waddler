import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'./tests/**/*.test.ts',
			// './tests/duckdb/waddler-unit.test.ts',
		],
		exclude: [],
		typecheck: {
			tsconfig: 'tsconfig.json',
		},
		testTimeout: 100000,
		hookTimeout: 100000,
	},
});
