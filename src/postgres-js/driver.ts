import type { Options, PostgresType, Sql } from 'postgres';
import postgres from 'postgres';
import { PgDialect } from '../pg-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { PostgresSQLTemplate } from './session.ts';
import { isConfig } from './utils.ts';

const createSqlTemplate = (
	client: Sql,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): PostgresSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new PostgresSQLTemplate<T>(sql, client, dialect);
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
		unsafe: async (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new PostgresSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends Sql>(
	...params: [
		TClient | string,
	] | [
		(({
			connection: string | ({ url?: string } & Options<Record<string, PostgresType>>);
		} | {
			client: TClient;
		})),
	]
) {
	const dialect = new PgDialect();

	if (typeof params[0] === 'string') {
		const client = postgres(params[0] as string);

		return createSqlTemplate(client, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: { url?: string } & Options<Record<string, PostgresType>>;
			client?: TClient;
		};

		if (client) return createSqlTemplate(client, dialect);

		if (typeof connection === 'object' && connection.url !== undefined) {
			const { url, ...config } = connection;

			const client = postgres(url, config);
			return createSqlTemplate(client, dialect);
		}

		const client_ = postgres(connection);
		return createSqlTemplate(client_, dialect);
	}

	return createSqlTemplate(params[0] as TClient, dialect);
}
