import type { PoolOptions } from 'mysql2';
import { createPool } from 'mysql2';
import type { MySQLIdentifierObject } from '../mysql-core/dialect.ts';
import { MySQLDialect } from '../mysql-core/dialect.ts';
import type { Identifier, Raw } from '../sql-template-params.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL, Values } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { SQLParamType, UnsafeParamType } from '../types.ts';
import type { MySql2Client } from './session.ts';
import { MySql2SQLTemplate } from './session.ts';
import { isConfig } from './utils.ts';

const createSqlTemplate = (
	client: MySql2Client,
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

		if (client) return createSqlTemplate(client, dialect);

		const pool = typeof connection === 'string'
			? createPool({
				uri: connection,
			})
			: createPool(connection!);

		return createSqlTemplate(pool, dialect);
	}

	return createSqlTemplate(params[0] as TClient, dialect);
}
