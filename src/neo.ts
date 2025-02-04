import type { DuckDBResult } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';
import { transformResultToArrays, transformResultToObjects } from './duckdb-neo/result-transformers.ts';
import { bindParams } from './duckdb-neo/utils.ts';
import type { Factory } from './pool-ts/types.ts';
import { RecyclingPool } from './recycling-pool.ts';
import { NeoSQLTemplate } from './sql-template-neo.ts';
import type { Identifier, Raw, SQLParamType, Values } from './sql-template.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from './sql-template.ts';
import type { DuckDBConnectionObj, UnsafeParamType } from './types.ts';

type RowData = {
	[columnName: string]: any;
};

export { SQLTemplate } from './sql-template.ts';
export interface SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): NeoSQLTemplate<T>;
	identifier(value: Identifier): SQLIdentifier;
	values(value: Values): SQLValues;
	raw(value: Raw): SQLRaw;
	unsafe(query: string, params?: UnsafeParamType[], options?: { rowMode: 'array' | 'default' }): Promise<
		{
			[columnName: string]: any;
		}[] | any[][]
	>;
	default: SQLDefault;
}

const createSqlTemplate = (pool: RecyclingPool<DuckDBConnectionObj>): SQL => {
	// [strings, params]: Parameters<SQL>
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NeoSQLTemplate<T> => {
		return new NeoSQLTemplate<T>(strings, params, pool);
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
		unsafe: async (query: string, params?: UnsafeParamType[], options?: { rowMode: 'array' | 'default' }) => {
			return await unsafeFunc(pool, query, params, options);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

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
		const newError = new Error((error as Error).message);
		throw newError;
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

	return createSqlTemplate(pool);
}
