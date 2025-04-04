import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'./tests/**/*.test.ts',
			// './tests/postgres-js/waddler.test.ts',
		],
		exclude: [],
		typecheck: {
			tsconfig: 'tsconfig.json',
		},
		testTimeout: 1000000,
		hookTimeout: 100000,
	},
});
