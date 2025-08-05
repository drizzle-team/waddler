import type { Connection as CallbackConnection, Pool as CallbackPool, PoolOptions } from 'mysql2';
import { createPool } from 'mysql2/promise';
import type { Connection, Pool } from 'mysql2/promise';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { MySQLDialect, SQLFunctions } from '../mysql-core/dialect.ts';
import { MySql2SQLTemplate } from './session.ts';
import { isCallbackClient } from './utils.ts';

export interface MySql2SQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new MySQLDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as MySql2SQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: Pool | Connection,
	configOptions: WaddlerConfig = {},
): SQL => {
	const dialect = new MySQLDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): MySql2SQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new MySql2SQLTemplate<T>(sql, client, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: async (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new MySql2SQLTemplate(sql, client, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

type MySql2Client = Pool | Connection | CallbackPool | CallbackConnection;

export function waddler<TClient extends MySql2Client>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | PoolOptions;
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const connectionString = params[0]!;
		const pool = createPool({
			uri: connectionString,
		});

		return createSqlTemplate(pool, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as ({
			connection?: PoolOptions | string;
			client?: TClient;
		} & WaddlerConfig);

		if (client) {
			const promiseClient = isCallbackClient(client) ? client.promise() : client as (Pool | Connection);

			return createSqlTemplate(promiseClient, configOptions);
		}

		const pool = typeof connection === 'string'
			? createPool({
				uri: connection,
			})
			: createPool(connection!);

		return createSqlTemplate(pool, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
