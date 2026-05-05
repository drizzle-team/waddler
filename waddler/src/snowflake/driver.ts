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

const normalizableAuthenticators = new Set([
	'SNOWFLAKE',
	'EXTERNALBROWSER',
	'SNOWFLAKE_JWT',
	'OAUTH',
	'USERNAME_PASSWORD_MFA',
	'OAUTH_AUTHORIZATION_CODE',
	'OAUTH_CLIENT_CREDENTIALS',
	'PROGRAMMATIC_ACCESS_TOKEN',
	'WORKLOAD_IDENTITY',
]);

const connectionStringSupportedAuthenticators = new Set([
	'SNOWFLAKE',
	'EXTERNALBROWSER',
]);

const objectConfigAuthenticators = new Set([
	'SNOWFLAKE_JWT',
	'OAUTH',
	'USERNAME_PASSWORD_MFA',
	'OAUTH_AUTHORIZATION_CODE',
	'OAUTH_CLIENT_CREDENTIALS',
	'PROGRAMMATIC_ACCESS_TOKEN',
	'WORKLOAD_IDENTITY',
]);

const decodeConnectionStringComponent = (value: string, label: string) => {
	try {
		return decodeURIComponent(value);
	} catch {
		throw new Error(`Invalid Snowflake connection string: malformed percent-encoding in ${label}`);
	}
};

const parseAuthenticatorUrl = (value: string) => {
	try {
		return new URL(value);
	} catch {
		return;
	}
};

const isOktaAuthenticatorUrl = (url: URL) => url.protocol === 'https:' && /(^|\.)okta\.com$/i.test(url.hostname);

const parseConnectionStringAuthenticator = (rawAuthenticator?: string) => {
	if (rawAuthenticator === undefined) return;

	const normalizedAuthenticator = rawAuthenticator.toUpperCase();
	if (normalizableAuthenticators.has(normalizedAuthenticator)) {
		if (objectConfigAuthenticators.has(normalizedAuthenticator)) {
			throw new Error(
				`Snowflake connection strings do not support authenticator=${normalizedAuthenticator}. `
					+ 'Use object-based configuration so required authentication options can be supplied.',
			);
		}

		if (connectionStringSupportedAuthenticators.has(normalizedAuthenticator)) {
			return normalizedAuthenticator;
		}
	}

	const authenticatorUrl = parseAuthenticatorUrl(rawAuthenticator);
	if (authenticatorUrl) {
		if (!isOktaAuthenticatorUrl(authenticatorUrl)) {
			throw new Error(
				'Snowflake connection string authenticator URLs must be an https://*.okta.com URL.',
			);
		}

		return authenticatorUrl.origin;
	}

	throw new Error(
		'Snowflake connection strings only support the default/SNOWFLAKE authenticator, '
			+ 'EXTERNALBROWSER, or an https://*.okta.com authenticator URL. '
			+ 'Use object-based configuration for other authenticators.',
	);
};

const parseConnectionString = (connectionString: string): ConnectionOptions => {
	const url = new URL(connectionString);
	if (url.protocol !== 'snowflake:') {
		throw new Error('Snowflake connection string must use snowflake:// protocol');
	}

	const pathSegments = url.pathname.split('/').filter(Boolean);
	if (pathSegments.length > 2) {
		throw new Error('Snowflake connection string path must be /<database>/<schema>');
	}

	const account = url.hostname;
	const username = decodeConnectionStringComponent(url.username, 'username');
	const password = decodeConnectionStringComponent(url.password, 'password');
	const authenticator = parseConnectionStringAuthenticator(url.searchParams.get('authenticator') ?? undefined);

	const isPasswordlessConnectionStringAuthenticator = authenticator === 'EXTERNALBROWSER';

	if (!account || !username || (!password && !isPasswordlessConnectionStringAuthenticator)) {
		throw new Error(
			'Snowflake connection string must include account, username, and password '
				+ '(or use authenticator=EXTERNALBROWSER for browser-based SSO)',
		);
	}

	const database = pathSegments[0] ? decodeConnectionStringComponent(pathSegments[0], 'database') : undefined;
	const schema = pathSegments[1] ? decodeConnectionStringComponent(pathSegments[1], 'schema') : undefined;
	const warehouse = url.searchParams.get('warehouse') ?? undefined;
	const role = url.searchParams.get('role') ?? undefined;

	const options: ConnectionOptions = {
		account,
		username,
	};
	if (password) options.password = password;
	if (authenticator) options.authenticator = authenticator;
	if (database) options.database = database;
	if (schema) options.schema = schema;
	if (warehouse) options.warehouse = warehouse;
	if (role) options.role = role;

	return options;
};

const createSqlTemplate = (
	client: SnowflakeClient,
	configOptions: WaddlerConfig = {},
): SnowflakeSQL => {
	const dialect = new SnowflakeDialect();
	let connecting: Promise<void> | undefined;
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const ensureConnected = async () => {
		if (client.isUp()) return;
		if (connecting) {
			await connecting;
			return;
		}

		connecting = new Promise<void>((resolve, reject) => {
			let settled = false;

			const resolveOnce = () => {
				if (settled) return;
				settled = true;
				resolve();
			};

			const rejectOnce = (error: unknown) => {
				if (settled) return;
				settled = true;
				reject(error);
			};

			const complete = (err?: Error | null) => {
				if (err) {
					rejectOnce(err);
					return;
				}

				resolveOnce();
			};

			if (typeof client.connectAsync === 'function') {
				try {
					const connectPromise = client.connectAsync(complete);
					void connectPromise.then(resolveOnce, rejectOnce);
				} catch (error) {
					rejectOnce(error);
				}
				return;
			}

			client.connect(complete);
		});

		try {
			await connecting;
		} finally {
			connecting = undefined;
		}
	};

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): SnowflakeSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new SnowflakeSQLTemplate<T>(sql, client, dialect, { logger }, undefined, ensureConnected);
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

			const unsafeDriver = new SnowflakeSQLTemplate(sql, client, dialect, { logger }, options, ensureConnected);
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

		if (connection === undefined) {
			throw new Error(
				'Invalid parameter for waddler.'
					+ '\nMust be a Snowflake connection string, { connection: string | ConnectionOptions }, or { client: snowflake.Connection }',
			);
		}

		const connectionOptions = typeof connection === 'string'
			? parseConnectionString(connection)
			: connection;
		const instance = snowflake.createConnection(connectionOptions);
		return createSqlTemplate(instance, configOptions);
	}

	throw new Error(
		'Invalid parameter for waddler.'
			+ '\nMust be a Snowflake connection string, { connection: string | ConnectionOptions }, or { client: snowflake.Connection }',
	);
}

// Re-export ConnectionOptions type from snowflake-sdk for better IDE support and documentation
export { type ConnectionOptions } from 'snowflake-sdk';
