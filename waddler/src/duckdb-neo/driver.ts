import type { DuckDBResult } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { DuckdbDialect, SQLFunctions } from '../duckdb-core/dialect.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import type { Factory } from '../pool-ts/types.ts';
import { RecyclingPool } from '../recycling-pool.ts';
import { SQLDefault, SQLIdentifier, SQLQuery, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { transformResultToArrays, transformResultToObjects } from './result-transformers.ts';
import { DuckdbNeoSQLTemplate } from './session.ts';
import type { DuckDBConnectionObj } from './types.ts';
import { bindParams } from './utils.ts';

export interface DuckdbNeoSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new DuckdbDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as DuckdbNeoSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (pool: RecyclingPool<DuckDBConnectionObj>, dialect: DuckdbDialect): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): DuckdbNeoSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);

		return new DuckdbNeoSQLTemplate<T>(sql, pool, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<IdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: async (query: string, params?: UnsafeParamType[], options?: { rowMode: 'array' | 'default' }) => {
			return await unsafeFunc(pool, query, params, options);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

// TODO: remove this function so unsafe function will depend on DuckdbNeoSQLTemplate.execute
const unsafeFunc = async (
	pool: RecyclingPool<DuckDBConnectionObj>,
	query: string,
	params?: UnsafeParamType[],
	options?: { rowMode: 'array' | 'default' },
) => {
	params = params ?? [];
	const rowMode = options?.rowMode ?? 'default';
	const connObj = await pool.acquire();

	let duckDbResult: DuckDBResult;

	// wrapping duckdb driver error in new js error to add stack trace to it
	try {
		const prepared = await connObj.connection.prepare(query);
		bindParams(prepared, params);

		duckDbResult = await prepared.run();
	} catch (error) {
		await pool.release(connObj);
		throw new WaddlerQueryError(query, params, error as Error);
	}

	if (rowMode === 'default') {
		const result = await transformResultToObjects(duckDbResult);

		await pool.release(connObj);

		return result;
	}

	// rowMode === "array"
	const result = await transformResultToArrays(duckDbResult);

	await pool.release(connObj);

	return result;
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
	const factory: Factory<DuckDBConnectionObj> = {
		create: async function() {
			// wrapping duckdb driver error in new js error to add stack trace to it
			try {
				const instance = await DuckDBInstance.create(url, {
					access_mode: accessMode,
					max_memory: maxMemory,
					threads: threads,
				});
				const conn = await instance.connect();

				const connObj: DuckDBConnectionObj = { instance, connection: conn };
				// Run any connection initialization commands here

				return connObj;
			} catch (error) {
				const newError = new Error((error as Error).message);
				throw newError;
			}
		},
		destroy: async function() {},
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

	const pool = new RecyclingPool<DuckDBConnectionObj>(factory, options);

	return createSqlTemplate(pool, dialect);
}
