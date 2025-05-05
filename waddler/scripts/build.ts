// import 'zx/globals';

// import { build } from 'tsup';

// fs.removeSync('dist');

// await build({
// 	entry: ['src/duckdb/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/duckdb',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/duckdb-neo/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/duckdb-neo',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/node-postgres/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/node-postgres',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/postgres-js/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/postgres-js',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/pglite/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/pglite',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/neon-http/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/neon-http',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/neon-serverless/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/neon-serverless',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/vercel-postgres/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/vercel-postgres',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/xata-http/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/xata-http',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/pg/bun-sql/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	external: ['bun'],
// 	outDir: './dist/bun-sql',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/gel/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/gel',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/mysql/mysql2/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/mysql2',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/mysql/tidb-serverless/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/tidb-serverless',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/mysql/planetscale-serverless/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/planetscale-serverless',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/better-sqlite3/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/better-sqlite3',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/bun-sqlite/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	external: ['bun:sqlite'],
// 	outDir: './dist/bun-sqlite',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/d1/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/d1',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/libsql/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/libsql/http/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql/http',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/libsql/node/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql/node',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/libsql/sqlite3/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql/sqlite3',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/libsql/wasm/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql/wasm',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/libsql/web/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql/web',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// // await build({
// // 	entry: ['src/sqlite/libsql/ws/index.ts'],
// // 	splitting: false,
// // 	sourcemap: true,
// // 	dts: true,
// // 	format: ['cjs', 'esm'],
// // 	bundle: true,
// // 	outDir: './dist/libsql/ws',
// // 	outExtension(ctx) {
// // 		if (ctx.format === 'cjs') {
// // 			return {
// // 				dts: '.d.cts',
// // 				js: '.cjs',
// // 			};
// // 		}
// // 		return {
// // 			dts: '.d.ts',
// // 			js: '.js',
// // 		};
// // 	},
// // });

// await build({
// 	entry: ['src/sqlite/durable-sqlite/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/durable-sqlite',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/op-sqlite/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/op-sqlite',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/sqlite/expo-sqlite/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/expo-sqlite',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// await build({
// 	entry: ['src/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist',
// 	outExtension(ctx) {
// 		if (ctx.format === 'cjs') {
// 			return {
// 				dts: '.d.cts',
// 				js: '.cjs',
// 			};
// 		}
// 		return {
// 			dts: '.d.ts',
// 			js: '.js',
// 		};
// 	},
// });

// fs.copyFileSync('package.json', 'dist/package.json');
// fs.copyFileSync('../README.md', 'dist/README.md');

import 'zx/globals';
import type { Options } from 'tsup';
import { build } from 'tsup';

fs.removeSync('dist');

const outExtension = (ctx: { format: string }) =>
	ctx.format === 'cjs'
		? { dts: '.d.cts', js: '.cjs' }
		: { dts: '.d.ts', js: '.js' };

const targets: Array<{
	entry: string;
	outDir: string;
	external?: string[];
}> = [
	{ entry: 'src/duckdb/index.ts', outDir: 'dist/duckdb' },
	{ entry: 'src/duckdb-neo/index.ts', outDir: 'dist/duckdb-neo' },
	{ entry: 'src/pg/node-postgres/index.ts', outDir: 'dist/node-postgres' },
	{ entry: 'src/pg/postgres-js/index.ts', outDir: 'dist/postgres-js' },
	{ entry: 'src/pg/pglite/index.ts', outDir: 'dist/pglite' },
	{ entry: 'src/pg/neon-http/index.ts', outDir: 'dist/neon-http' },
	{ entry: 'src/pg/neon-serverless/index.ts', outDir: 'dist/neon-serverless' },
	{ entry: 'src/pg/vercel-postgres/index.ts', outDir: 'dist/vercel-postgres' },
	{ entry: 'src/pg/xata-http/index.ts', outDir: 'dist/xata-http' },
	{ entry: 'src/pg/bun-sql/index.ts', outDir: 'dist/bun-sql', external: ['bun'] },
	{ entry: 'src/gel/index.ts', outDir: 'dist/gel' },
	{ entry: 'src/mysql/mysql2/index.ts', outDir: 'dist/mysql2' },
	{ entry: 'src/mysql/tidb-serverless/index.ts', outDir: 'dist/tidb-serverless' },
	{ entry: 'src/mysql/planetscale-serverless/index.ts', outDir: 'dist/planetscale-serverless' },
	{ entry: 'src/sqlite/better-sqlite3/index.ts', outDir: 'dist/better-sqlite3' },
	{ entry: 'src/sqlite/bun-sqlite/index.ts', outDir: 'dist/bun-sqlite', external: ['bun:sqlite'] },
	{ entry: 'src/sqlite/d1/index.ts', outDir: 'dist/d1' },
	{ entry: 'src/sqlite/libsql/index.ts', outDir: 'dist/libsql' },
	{ entry: 'src/sqlite/libsql/http/index.ts', outDir: 'dist/libsql/http' },
	{ entry: 'src/sqlite/libsql/node/index.ts', outDir: 'dist/libsql/node' },
	{ entry: 'src/sqlite/libsql/sqlite3/index.ts', outDir: 'dist/libsql/sqlite3' },
	{ entry: 'src/sqlite/libsql/wasm/index.ts', outDir: 'dist/libsql/wasm' },
	{ entry: 'src/sqlite/libsql/web/index.ts', outDir: 'dist/libsql/web' },
	{ entry: 'src/sqlite/durable-sqlite/index.ts', outDir: 'dist/durable-sqlite' },
	{ entry: 'src/sqlite/op-sqlite/index.ts', outDir: 'dist/op-sqlite' },
	{ entry: 'src/sqlite/expo-sqlite/index.ts', outDir: 'dist/expo-sqlite' },

	{ entry: 'src/index.ts', outDir: 'dist' },
	{ entry: 'src/extensions/index.ts', outDir: 'dist/extensions' },
	{ entry: 'src/extensions/pg-query-stream/index.ts', outDir: 'dist/extensions/pg-query-stream' },
];

for (const target of targets) {
	const { entry, outDir, external } = target;
	await build({
		entry: [entry],
		splitting: false,
		sourcemap: true,
		dts: true,
		format: ['cjs', 'esm'],
		bundle: true,
		outDir,
		outExtension,
		...(external ? { external } : {}),
	} as Options);
}

fs.copyFileSync('package.json', 'dist/package.json');
fs.copyFileSync('../README.md', 'dist/README.md');
