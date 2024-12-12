import duckdb from 'duckdb';
import type { Factory } from './pool-ts/types.ts';
import { RecyclingPool } from './recycling-pool.ts';
import { DefaultSQLTemplate } from './sql-template-default.ts';
import type { Identifier, Raw, SQLParamType, Values } from './sql-template.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from './sql-template.ts';

export { SQLTemplate } from './sql-template.ts';
export interface SQL {
	<T = duckdb.RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): DefaultSQLTemplate<T>;
	identifier(value: Identifier): SQLIdentifier;
	values(value: Values): SQLValues;
	raw(value: Raw): SQLRaw;
	default: SQLDefault;
}

const createSqlTemplate = (pool: RecyclingPool<duckdb.Database>): SQL => {
	// [strings, params]: Parameters<SQL>
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): DefaultSQLTemplate<T> => {
		return new DefaultSQLTemplate<T>(strings, params, pool);
	};

	Object.assign(fn, {
		identifier: (value: Identifier) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

const createFactory = (
	{
		url,
		accessMode = 'read_write',
		maxMemory = '512MB',
		threads = '4',
	}: {
		url: string;
		accessMode?: 'read_only' | 'read_write';
		maxMemory?: string;
		threads?: string;
	},
) => {
	const factory: Factory<duckdb.Database> = {
		create: async function() {
			// TODO: make duckdb.Database awaited
			const db = new duckdb.Database(url, {
				access_mode: accessMode,
				max_memory: maxMemory,
				threads: threads,
			}, (err) => {
				if (err) {
					console.error(err);
				}
			});

			// Run any connection initialization commands here

			return db;
		},
		destroy: async function(db: duckdb.Database) {
			return db.close();
		},
	};

	return factory;
};

export function waddler(
	{
		dbUrl,
		url,
		min = 1,
		max = 1,
		accessMode = 'read_write',
		maxMemory = '512MB',
		threads = '4',
	}: {
		/** @deprecated */
		dbUrl?: string;
		url: string;
		min?: number;
		max?: number;
		accessMode?: 'read_only' | 'read_write';
		maxMemory?: string;
		threads?: string;
	},
) {
	url = url === undefined && dbUrl !== undefined ? dbUrl : url;

	const factory = createFactory({
		url,
		accessMode,
		maxMemory,
		threads,
	});
	const options = {
		max, // maximum size of the pool
		min, // minimum size of the pool
	};

	const pool = new RecyclingPool<duckdb.Database>(factory, options);

	return createSqlTemplate(pool);
}
