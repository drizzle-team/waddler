import type { Client } from '@libsql/client';
import type { SqliteIdentifierObject } from '~/sqlite-core';
import type { SQL } from '../sql';
import { SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import { SQLWrapper } from '../sql.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';
import { UnsafePromise } from '../sqlite-core/dialect.ts';
import type { Identifier, Raw, RowData, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { LibsqlSQLTemplate } from './session.ts';

export interface LibsqlSQL extends Omit<SQL, 'default' | 'unsafe'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): LibsqlSQLTemplate<T>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		LibsqlSQLTemplate<any>
	>;
}

export const createSqlTemplate = <
	TClient extends Client = Client,
>(
	client: TClient,
	dialect: SqliteDialect,
): LibsqlSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): LibsqlSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new LibsqlSQLTemplate<T>(sql, client, dialect);
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
		unsafe: (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new LibsqlSQLTemplate(sql, client, dialect, options);
			const unsafePromise = new UnsafePromise(unsafeDriver);

			return unsafePromise;
		},
		// TODO: implement default
		// get default() {
		// 	throw new Error(`sql.default is not implemented for sqlite.`);
		// },
	});

	return fn as any;
};
