import 'zx/globals';

const entries: Array<string> = [
	'src/duckdb/index.ts',
	'src/duckdb-neo/index.ts',
	'src/pg/node-postgres/index.ts',
	'src/pg/postgres-js/index.ts',
	'src/pg/pglite/index.ts',
	'src/pg/neon-http/index.ts',
	'src/pg/neon-serverless/index.ts',
	'src/pg/vercel-postgres/index.ts',
	'src/pg/xata-http/index.ts',
	'src/pg/bun-sql/index.ts',
	'src/gel/index.ts',
	'src/mysql/mysql2/index.ts',
	'src/mysql/tidb-serverless/index.ts',
	'src/mysql/planetscale-serverless/index.ts',
	'src/sqlite/better-sqlite3/index.ts',
	'src/sqlite/bun-sqlite/index.ts',
	'src/sqlite/d1/index.ts',
	'src/sqlite/libsql/index.ts',
	'src/sqlite/libsql/http/index.ts',
	'src/sqlite/libsql/node/index.ts',
	'src/sqlite/libsql/sqlite3/index.ts',
	'src/sqlite/libsql/wasm/index.ts',
	'src/sqlite/libsql/web/index.ts',
	'src/sqlite/libsql/ws/index.ts',
	'src/sqlite/durable-sqlite/index.ts',
	'src/sqlite/op-sqlite/index.ts',
	'src/sqlite/expo-sqlite/index.ts',
	'src/clickhouse/index.ts',

	'src/index.ts',
	'src/extensions/index.ts',
	'src/extensions/pg-query-stream/index.ts',
];

const updateAndCopyPackageJson = async () => {
	const pkg = await fs.readJSON('package.json');

	// const entries = await glob('src/**/*.ts');

	pkg.exports = entries.reduce<
		Record<string, {
			import: {
				types?: string;
				default: string;
			};
			require: {
				types: string;
				default: string;
			};
			// default: string;
			// types: string;
		}>
	>(
		(acc, rawEntry) => {
			const entry = rawEntry.match(/src\/(.*)\.ts/)![1]!;

			if (entry.endsWith('index')) {
				const importEntry = `./${entry}.js`;
				const requireEntry = `./${entry}.cjs`;
				const exportsEntry = entry === 'index'
					? '.'
					: ['extensions', 'gel', 'duckdb', 'clickhouse'].some((key) => entry.includes(key))
					? './' + entry.split('/').slice(0, -1).join('/')
					: './' + entry.split('/').slice(1, -1).join('/');

				acc[exportsEntry] = {
					import: {
						types: `./${entry}.d.ts`,
						default: importEntry,
					},
					require: {
						types: `./${entry}.d.cts`,
						default: requireEntry,
					},
					// types: `./${entry}.d.ts`,
					// default: importEntry,
				};
			}

			return acc;
		},
		{},
	);

	await fs.writeJSON('dist.new/package.json', pkg, { spaces: 2 });
};

await fs.remove('dist.new');

await $`tsup`.stdio('pipe', 'pipe', 'pipe');

await $`scripts/fix-imports.ts`;

await fs.copy('../README.md', 'dist.new/README.md');
await updateAndCopyPackageJson();

await fs.remove('dist');
await fs.rename('dist.new', 'dist');
