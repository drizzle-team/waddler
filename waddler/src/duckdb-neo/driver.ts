import { DuckDBInstance } from '@duckdb/node-api';
import { DuckdbDialect, SQLFunctions } from '../duckdb-core/dialect.ts';
import type { Logger } from '../logger.ts';
import { DefaultLogger } from '../logger.ts';
import type { Factory } from '../pool-ts/types.ts';
import { RecyclingPool } from '../recycling-pool.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../types.ts';
import { DuckdbNeoSQLTemplate } from './session.ts';
import type { DuckDBConnectionObj } from './types.ts';

export interface DuckdbNeoSQL extends SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): DuckdbNeoSQLTemplate<T>;
}

const createSqlTemplate = (
	pool: RecyclingPool<DuckDBConnectionObj>,
	configOptions: WaddlerConfig,
): DuckdbNeoSQL => {
	const dialect = new DuckdbDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): DuckdbNeoSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);

		return new DuckdbNeoSQLTemplate<T>(sql, pool, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: async (query: string, params?: UnsafeParamType[], options?: { rowMode: 'array' | 'default' }) => {
			params = params ?? [];
			options = options ?? { rowMode: 'default' };

			const sqlWrapper = new SQLWrapper();
			sqlWrapper.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new DuckdbNeoSQLTemplate(sqlWrapper, pool, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
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
		logger,
	}: {
		/** @deprecated */
		dbUrl?: string;
		url: string;
		min?: number;
		max?: number;
		accessMode?: 'read_only' | 'read_write';
		maxMemory?: string;
		threads?: string;
	} & WaddlerConfig,
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

	return createSqlTemplate(pool, { logger });
}
