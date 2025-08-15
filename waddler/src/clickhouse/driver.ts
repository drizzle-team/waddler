import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config';
import type { SQLValues } from '~/sql-template-params.ts';
import { SQLQuery } from '~/sql-template-params.ts';
import { isConfig } from '~/utils.ts';
import type { DbType } from '../clickhouse-core/index.ts';
import { ClickHouseDialect, ClickHouseSQLCommonParam, SQLFunctions, UnsafePromise } from '../clickhouse-core/index.ts';
import type { Logger } from '../logger.ts';
import { DefaultLogger } from '../logger.ts';
import { type SQL, SQLWrapper } from '../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType, Values, WaddlerConfig } from '../types.ts';
import { ClickHouseSQLTemplate } from './session.ts';

export interface ClickHouseSQL extends Omit<SQL, 'unsafe' | 'values'> {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): ClickHouseSQLTemplate<T>;

	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: Record<string, UnsafeParamType>,
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		ClickHouseSQLTemplate<any>
	>;

	/**
	 * @param values - A two-dimensional array of rows to insert; each inner array represents one row of values.
	 * @param types - (Optional) An array of ClickHouse data types (e.g. ['Int32', 'String']) used to cast each column value.
	 *
	 * If omitted, or if there are fewer types than columns, any missing types default to 'String'.
	 *
	 * For full list of types, see https://clickhouse.com/docs/sql-reference/data-types
	 *
	 * @example
	 * ```ts
	 * const rows = [
	 *   [1, 'qwerty1'],
	 *   [2, 'qwerty2']
	 * ];
	 * const types = ['Int32', 'String'];
	 *
	 * sql`INSERT INTO <tableIdentifier> VALUES ${sql.values(rows, types)};`
	 * ```
	 *
	 * This generates and executes:
	 *
	 * ```sql
	 * INSERT INTO <tableIdentifier>
	 * VALUES ({val1:Int32}, {val2:String}), ({val3:Int32}, {val4:String});
	 * ```
	 *
	 * with these query parameters:
	 * ```ts
	 * {
	 *   val1: 1,
	 *   val2: 'qwerty1',
	 *   val3: 2,
	 *   val4: 'qwerty2'
	 * }
	 * ```
	 */
	values(value: Values, types?: DbType[]): SQLValues;
	param(value: any, type: DbType): ClickHouseSQLCommonParam;
}

export interface ClickHouseSQLQuery
	extends Pick<ClickHouseSQL, 'values' | 'param'>, Pick<SQL, 'identifier' | 'raw' | 'default'>
{
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery<ClickHouseDialect>;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.setOverrides({ SQLCommonParam: ClickHouseSQLCommonParam });
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new ClickHouseDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as ClickHouseSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: ClickHouseClient,
	configOptions: WaddlerConfig = {},
): ClickHouseSQL => {
	const dialect = new ClickHouseDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): ClickHouseSQLTemplate<T> => {
		const sqlWrapper = new SQLWrapper();
		sqlWrapper.setOverrides({ SQLCommonParam: ClickHouseSQLCommonParam });
		sqlWrapper.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new ClickHouseSQLTemplate<T>(sqlWrapper, client, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: (
			query: string,
			params?: Record<string, UnsafeParamType>,
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? {};
			options = options ?? { rowMode: 'object' };

			const sqlWrapper = new SQLWrapper();
			sqlWrapper.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new ClickHouseSQLTemplate(sqlWrapper, client, dialect, { logger }, options);
			const unsafePromise = new UnsafePromise(unsafeDriver);

			return unsafePromise;
		},
	});

	return fn as any;
};

export function waddler<TClient extends ClickHouseClient>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | NodeClickHouseClientConfigOptions;
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const connectionString = params[0]!;
		const pool = createClient({
			url: connectionString,
		});

		return createSqlTemplate(pool, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as ({
			connection?: NodeClickHouseClientConfigOptions | string;
			client?: TClient;
		} & WaddlerConfig);

		if (client) {
			return createSqlTemplate(client, configOptions);
		}

		const client_ = typeof connection === 'string'
			? createClient({
				url: connection,
			})
			: createClient(connection!);

		return createSqlTemplate(client_, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
