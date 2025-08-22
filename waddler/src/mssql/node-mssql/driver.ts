import type mssql from 'mssql';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { MsSqlDialect, SQLFunctions } from '../../mssql-core/dialect.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { AutoPool } from './pool.ts';
import type { NodeMsSqlClient } from './session.ts';
import { NodeMsSqlSQLTemplate } from './session.ts';

export interface NodeMsSqlSQL extends Omit<SQL, 'unsafe'> {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): NodeMsSqlSQLTemplate<T>;

	/**
	 * executes a query with parameters using the node-mssql driver
	 * @param query SQL query string
	 * @example
	 * ```ts
	 * `insert into users(id, name, age) values (@p1, @p2, @p3);`
	 * ```
	 *
	 * @param params query parameters
	 * @example
	 * ```ts
	 * [1, 'alex', 23]
	 * ```
	 *
	 * @param options.rowMode format in which the query result should be returned;
	 * defaults to 'object'
	 * @example
	 * ```ts
	 * // rowMode = 'object'
	 * [
	 * 	{id: 1, name: 'alex', age: 23}
	 * ]
	 *
	 * // rowMode = 'array'
	 * [
	 * 	[1, 'alex', 23]
	 * ]
	 * ```
	 *
	 * @param options.getParamName function that returns the parameter name based on its number;
	 * default format is `p<number>`
	 * @example
	 * ```ts
	 * // for a query like this
	 * `insert into users(id, name, age) values (@p1, @p2, @p3);`
	 *
	 * // parameter names are 'p1', 'p2', 'p3'
	 * ```
	 */
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode?: RowMode; getParamName?: (lastParamNumber: number) => string },
	): Promise<
		RowMode extends 'array' ? any[][] : {
			[columnName: string]: any;
		}[]
	>;
}

const createSqlTemplate = (
	client: NodeMsSqlClient,
	configOptions: WaddlerConfig = {},
): NodeMsSqlSQL => {
	const dialect = new MsSqlDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NodeMsSqlSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new NodeMsSqlSQLTemplate<T>(sql, client, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: async (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode?: 'array' | 'object'; getParamName?: (lastParamNumber: number) => string },
		) => {
			params = params ?? [];
			options = options ?? {};
			options.rowMode = options.rowMode ?? 'object';

			const sql = new SQLWrapper();
			sql.with({ rawParams: { sql: query, params } });
			const unsafeDriver = new NodeMsSqlSQLTemplate(
				sql,
				client,
				dialect,
				{ logger },
				options as Required<Pick<typeof options, 'rowMode'>> & Pick<typeof options, 'getParamName'>,
			);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends NodeMsSqlClient = mssql.ConnectionPool>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | mssql.config;
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const instance = new AutoPool(params[0]);

		return createSqlTemplate(instance, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as ({
			connection?: mssql.config | string;
			client?: TClient;
		} & WaddlerConfig);

		if (client) return createSqlTemplate(client, configOptions);

		const instance = typeof connection === 'string'
			? new AutoPool(connection)
			: new AutoPool(connection!);

		return createSqlTemplate(instance, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
