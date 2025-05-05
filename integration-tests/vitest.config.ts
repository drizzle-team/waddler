import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			// './tests/pg/postgres-js/*.test.ts',
			'./tests/**/*.test.ts',
		],
		exclude: [
			'./tests/sqlite/bun-sqlite/**/*.test.ts',
			'./tests/pg/bun-sql/**/*.test.ts',
		],
		typecheck: {
			tsconfig: 'tsconfig.json',
		},
		testTimeout: 1000000,
		hookTimeout: 100000,
		fileParallelism: false,
	},
});
