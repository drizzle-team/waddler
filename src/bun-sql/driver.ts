/// <reference types="bun-types" />
import type { SQLOptions } from 'bun';
import { SQL as BunSql } from 'bun';
import { PgDialect } from '~/pg-core/dialect.ts';
import type { SQL } from '../sql';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import { SQLWrapper } from '../sql.ts';
import type { SqliteIdentifierObject } from '../sqlite-core';
import type { Identifier, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import { BunSqlSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: BunSql,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): BunSqlSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new BunSqlSQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<SqliteIdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: async <RowMode extends 'array' | 'object'>(
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: RowMode },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' as RowMode };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new BunSqlSQLTemplate(sql, client, dialect, options);

			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends BunSql = BunSql>(
	...params: [
		TClient | string,
	] | [
		(({
			connection: string | ({ url?: string } & SQLOptions);
		} | {
			client: TClient;
		})),
	]
) {
	const dialect = new PgDialect();

	if (typeof params[0] === 'string') {
		const instance = new BunSql(params[0]);

		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: { url?: string } & SQLOptions;
			client?: TClient;
		};

		if (client) return createSqlTemplate(client, dialect);

		if (typeof connection === 'object' && connection.url !== undefined) {
			const { url, ...config } = connection;

			const instance = new BunSql({ url, ...config });
			return createSqlTemplate(instance, dialect);
		}

		const instance = new BunSql(connection);
		return createSqlTemplate(instance, dialect);
	}

	return createSqlTemplate(params[0] as TClient, dialect);
}
