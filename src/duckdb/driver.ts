import duckdb from 'duckdb';
import type { DuckdbIdentifierObject, DuckdbValues } from '../duckdb-core/dialect.ts';
import { DuckdbDialect } from '../duckdb-core/dialect.ts';
import type { Factory } from '../pool-ts/types.ts';
import { RecyclingPool } from '../recycling-pool.ts';
import type { Identifier, Raw } from '../sql-template-params.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import { SQLWrapper } from '../sql.ts';
import type { RowData, SQLParamType } from '../types.ts';
import { DuckdbSQLTemplate } from './session.ts';

export interface SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): DuckdbSQLTemplate<T>;
	identifier(value: Identifier<DuckdbIdentifierObject>): SQLIdentifier<DuckdbIdentifierObject>;
	values(value: DuckdbValues): SQLValues<DuckdbValues>;
	raw(value: Raw): SQLRaw;
	default: SQLDefault;
}

const createSqlTemplate = (pool: RecyclingPool<duckdb.Database>, dialect: DuckdbDialect): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): DuckdbSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);

		return new DuckdbSQLTemplate<T>(sql, pool, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<DuckdbIdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: DuckdbValues) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

function createDatabase(url: string, options: Record<string, string>): Promise<duckdb.Database> {
	return new Promise((resolve, reject) => {
		const db = new duckdb.Database(url, options, (err) => {
			if (err) {
				return reject(err);
			}
			resolve(db);
		});
	});
}

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
			// wrapping duckdb driver error in new js error to add stack trace to it
			try {
				const db = await createDatabase(url, {
					access_mode: accessMode,
					max_memory: maxMemory,
					threads: threads,
				});

				// Run any connection initialization commands here

				return db;
			} catch (error) {
				const newError = new Error((error as Error).message);
				throw newError;
			}
		},
		destroy: async function(db: duckdb.Database) {
			// wrapping duckdb driver error in js error to add stack trace to it
			try {
				return db.close();
			} catch (error) {
				const newError = new Error((error as Error).message);
				throw newError;
			}
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
	const dialect = new DuckdbDialect();
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

	return createSqlTemplate(pool, dialect);
}
