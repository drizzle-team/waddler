/// <reference types="bun-types" />
import type { SQLOptions } from 'bun';
import { SQL as BunSql } from 'bun';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PgDialect, SQLFunctions } from '../pg-core/dialect.ts';
import { BunSqlSQLTemplate } from './session.ts';

export interface BunSqlSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new PgDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as BunSqlSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

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
		...SQLFunctions,
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
	});

	return fn as any;
};

export function waddler<TClient extends BunSql = BunSql>(
	...params: [
		string,
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

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
