import type { DB } from '@op-engineering/op-sqlite';
import type { SqliteIdentifierObject } from '~/sqlite/sqlite-core/index.ts';
import type { SQLIdentifier } from '../../sql-template-params.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, RowData, SQLParamType, UnsafeParamType } from '../../types.ts';
import { SQLFunctions, SqliteDialect, UnsafePromise } from '../sqlite-core/dialect.ts';
import { OpSqliteSQLTemplate } from './session.ts';

export interface OpSqliteSQL extends Omit<SQL, 'default' | 'unsafe'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): OpSqliteSQLTemplate<T>;
	identifier(value: Identifier<SqliteIdentifierObject>): SQLIdentifier<SqliteIdentifierObject>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		OpSqliteSQLTemplate<any>
	>;
}

export interface OpSqliteSQLQuery extends Pick<SQL, 'raw' | 'values'>, Pick<OpSqliteSQL, 'identifier'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new SqliteDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as OpSqliteSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: DB,
	dialect: SqliteDialect,
): OpSqliteSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): OpSqliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// client.defaultSafeIntegers(true);
		return new OpSqliteSQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new OpSqliteSQLTemplate(sql, client, dialect, options);
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

export function waddler({ client }: { client: DB }) {
	const dialect = new SqliteDialect();

	return createSqlTemplate(client, dialect);
}
