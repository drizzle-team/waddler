import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			// './tests/neon-serverless/**/*.test.ts',
			'./tests/**/*.test.ts',
		],
		exclude: [
			'./tests/bun-sqlite/**/*.test.ts',
		],
		typecheck: {
			tsconfig: 'tsconfig.json',
		},
		testTimeout: 1000000,
		hookTimeout: 100000,
		fileParallelism: true,
	},
});
