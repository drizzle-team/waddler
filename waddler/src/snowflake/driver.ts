import type { Connection, ConnectionOptions } from 'snowflake-sdk';
import snowflake from 'snowflake-sdk';
import type { Logger } from '../logger.ts';
import { DefaultLogger } from '../logger.ts';
import type { SnowflakeIdentifierObject } from '../snowflake-core/dialect.ts';
import { SnowflakeDialect, SQLFunctions } from '../snowflake-core/dialect.ts';
import type { SQLIdentifier } from '../sql-template-params.ts';
import { SQLQuery } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../types.ts';
import { isConfig } from '../utils.ts';
import { SnowflakeSQLTemplate } from './session.ts';

export type SnowflakeClient = Connection;

export interface SnowflakeSQL extends Omit<SQL, 'identifier'> {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): SnowflakeSQLTemplate<T>;
	identifier(value: Identifier<SnowflakeIdentifierObject>): SQLIdentifier<SnowflakeIdentifierObject>;
}

export interface SnowflakeSQLQuery extends Pick<SnowflakeSQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new SnowflakeDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as SnowflakeSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const parseConnectionString = (connectionString: string): ConnectionOptions => {
	const url = new URL(connectionString);
	if (url.protocol !== 'snowflake:') {
		throw new Error('Snowflake connection string must use snowflake:// protocol');
	}

	const pathSegments = url.pathname.split('/').filter(Boolean);

	const account = url.hostname;
	const username = decodeURIComponent(url.username);
	const password = decodeURIComponent(url.password);

	if (!account || !username || !password) {
		throw new Error('Snowflake connection string must include account, username, and password');
	}

	const database = pathSegments[0];
	const schema = pathSegments[1];
	const warehouse = url.searchParams.get('warehouse') ?? undefined;
	const role = url.searchParams.get('role') ?? undefined;

	return {
		account,
		username,
		password,
		database,
		schema,
		warehouse,
		role,
	};
};

const createSqlTemplate = (
	client: SnowflakeClient,
	configOptions: WaddlerConfig = {},
): SnowflakeSQL => {
	const dialect = new SnowflakeDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): SnowflakeSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new SnowflakeSQLTemplate<T>(sql, client, dialect, { logger });
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
			sql.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new SnowflakeSQLTemplate(sql, client, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends SnowflakeClient = SnowflakeClient>(
	...params:
		| [
			string,
		]
		| [
			string,
			WaddlerConfig,
		]
		| [
			(
				& WaddlerConfig
				& ({
					connection: string | ConnectionOptions;
				} | {
					client: TClient;
				})
			),
		]
) {
	if (typeof params[0] === 'string') {
		const connectionOptions = parseConnectionString(params[0]);
		const instance = snowflake.createConnection(connectionOptions);

		return createSqlTemplate(instance, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as (
			& ({ connection?: string | ConnectionOptions; client?: TClient })
			& WaddlerConfig
		);

		if (client) {
			return createSqlTemplate(client, configOptions);
		}

		const connectionOptions = typeof connection === 'string'
			? parseConnectionString(connection)
			: connection!;
		const instance = snowflake.createConnection(connectionOptions);
		return createSqlTemplate(instance, configOptions);
	}

	throw new Error(
		'Invalid parameter for waddler.',
	);
}
