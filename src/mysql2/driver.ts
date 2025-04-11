import type { Connection as CallbackConnection, Pool as CallbackPool, PoolOptions } from 'mysql2';
import { createPool } from 'mysql2/promise';
import type { Connection, Pool } from 'mysql2/promise';
import type { MySQLIdentifierObject } from '../mysql-core/dialect.ts';
import { MySQLDialect } from '../mysql-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import { MySql2SQLTemplate } from './session.ts';
import { isCallbackClient } from './utils.ts';

const createSqlTemplate = (
	client: Pool | Connection,
	dialect: MySQLDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): MySql2SQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new MySql2SQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<MySQLIdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: async (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new MySql2SQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

type MySql2Client = Pool | Connection | CallbackPool | CallbackConnection;

export function waddler<TClient extends MySql2Client>(
	...params: [
		TClient | string,
	] | [
		(({
			connection: string | PoolOptions;
		} | {
			client: TClient;
		})),
	]
) {
	const dialect = new MySQLDialect();

	if (typeof params[0] === 'string') {
		const connectionString = params[0]!;
		const pool = createPool({
			uri: connectionString,
		});

		return createSqlTemplate(pool, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: PoolOptions | string;
			client?: TClient;
		};

		if (client) {
			const promiseClient = isCallbackClient(client) ? client.promise() : client as (Pool | Connection);

			return createSqlTemplate(promiseClient, dialect);
		}

		const pool = typeof connection === 'string'
			? createPool({
				uri: connection,
			})
			: createPool(connection!);

		return createSqlTemplate(pool, dialect);
	}

	const client = isCallbackClient(params[0]) ? params[0].promise() : params[0];

	return createSqlTemplate(client as (Pool | Connection), dialect);
}
