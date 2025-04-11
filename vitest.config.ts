import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'./tests/bun-sqlite/*.test.ts',
			// './tests/**/*.test.ts',
		],
		exclude: [],
		typecheck: {
			tsconfig: 'tsconfig.json',
		},
		testTimeout: 1000000,
		hookTimeout: 100000,
	},
});
