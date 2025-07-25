import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'./tests/**/*.test.ts',
		],
		exclude: [
			...(process.env['RUN_EXTERNAL_DB_TESTS']
				? []
				: [
					'./tests/pg/neon-http/waddler.test.ts',
					'./tests/pg/neon-serverless/waddler.test.ts',
					'./tests/pg/vercel-postgres/waddler.test.ts',
					'./tests/pg/xata-http/waddler.test.ts',
					'./tests/sqlite/libsql/libsql-http-waddler.test.ts',
					'./tests/sqlite/libsql/libsql-node-waddler.test.ts',
					'./tests/sqlite/libsql/libsql-web-waddler.test.ts',
					'./tests/sqlite/libsql/libsql-waddler.test.ts',
					'./tests/mysql/planetscale-serverless/waddler.test.ts',
					'./tests/mysql/tidb-serverless/waddler.test.ts',
				]),
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
