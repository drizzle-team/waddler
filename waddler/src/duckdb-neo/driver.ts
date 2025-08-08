import { DuckDBInstance } from '@duckdb/node-api';
import { DuckdbDialect, SQLFunctions } from '../duckdb-core/dialect.ts';
import type { Logger } from '../logger.ts';
import { DefaultLogger } from '../logger.ts';
import type { Factory } from '../pool-ts/types.ts';
import { RecyclingPool } from '../recycling-pool.ts';
import { SQLDefault, SQLIdentifier, SQLQuery, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type {
	Identifier,
	IdentifierObject,
	Raw,
	SQLParamType,
	UnsafeParamType,
	Values,
	WaddlerConfig,
} from '../types.ts';
import { DuckdbNeoSQLTemplate } from './session.ts';
import type { DuckDBConnectionObj } from './types.ts';

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

const createSqlTemplate = (
	pool: RecyclingPool<DuckDBConnectionObj>,
	configOptions: WaddlerConfig,
): SQL => {
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
			params = params ?? [];
			options = options ?? { rowMode: 'default' };

			const sqlWrapper = new SQLWrapper();
			sqlWrapper.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new DuckdbNeoSQLTemplate(sqlWrapper, pool, dialect, { logger }, options);
			return await unsafeDriver.execute();
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
