import 'zx/globals';

import { build } from 'tsup';

fs.removeSync('dist');

await build({
	entry: ['src/duckdb/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/duckdb',
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
	entry: ['src/duckdb-neo/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/duckdb-neo',
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
	entry: ['src/node-postgres/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/node-postgres',
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
	entry: ['src/postgres-js/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/postgres-js',
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
	entry: ['src/pglite/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/pglite',
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
	entry: ['src/neon-http/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/neon-http',
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
	entry: ['src/neon-serverless/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/neon-serverless',
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
	entry: ['src/vercel-postgres/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/vercel-postgres',
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
	entry: ['src/xata-http/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/xata-http',
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
	entry: ['src/bun-sql/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	external: ['bun'],
	outDir: './dist/bun-sql',
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
	entry: ['src/mysql2/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/mysql2',
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
	entry: ['src/better-sqlite3/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/better-sqlite3',
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
	entry: ['src/bun-sqlite/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	external: ['bun:sqlite'],
	outDir: './dist/bun-sqlite',
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
	entry: ['src/d1/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/d1',
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
	entry: ['src/libsql/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/libsql',
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
	entry: ['src/libsql/http/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/libsql/http',
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
	entry: ['src/libsql/node/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/libsql/node',
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
	entry: ['src/libsql/sqlite3/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/libsql/sqlite3',
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

// await build({
// 	entry: ['src/libsql/wasm/index.ts'],
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

await build({
	entry: ['src/libsql/web/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist/libsql/web',
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

// await build({
// 	entry: ['src/libsql/ws/index.ts'],
// 	splitting: false,
// 	sourcemap: true,
// 	dts: true,
// 	format: ['cjs', 'esm'],
// 	bundle: true,
// 	outDir: './dist/libsql/ws',
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

await build({
	entry: ['src/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	bundle: true,
	outDir: './dist',
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
