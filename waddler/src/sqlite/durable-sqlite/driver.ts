/// <reference types="@cloudflare/workers-types" />

import type { SqliteIdentifierObject } from '~/sqlite/sqlite-core/index.ts';
import { SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, Raw, RowData, SQLParamType, UnsafeParamType, Values } from '../../types.ts';
import { SqliteDialect, UnsafePromise } from '../sqlite-core/dialect.ts';
import { DurableSqliteSQLTemplate } from './session.ts';

export interface DurableSqliteSQL extends Omit<SQL, 'default' | 'unsafe'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): DurableSqliteSQLTemplate<T>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		DurableSqliteSQLTemplate<any>
	>;
}

const createSqlTemplate = (
	client: DurableObjectStorage,
	dialect: SqliteDialect,
): DurableSqliteSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): DurableSqliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// client.defaultSafeIntegers(true);
		return new DurableSqliteSQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new DurableSqliteSQLTemplate(sql, client, dialect, options);
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

export function waddler<
	TClient extends DurableObjectStorage = DurableObjectStorage,
>(
	{ client }: { client: TClient },
) {
	const dialect = new SqliteDialect();

	return createSqlTemplate(client, dialect);
}
