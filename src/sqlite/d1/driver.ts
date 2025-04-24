/// <reference types="@cloudflare/workers-types" />

import type { D1Database as MiniflareD1Database } from '@miniflare/d1';
import type { SqliteIdentifierObject } from '~/sqlite/sqlite-core/index.ts';
import { SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, IfNotImported, Raw, RowData, SQLParamType, UnsafeParamType, Values } from '../../types.ts';
import { SqliteDialect, UnsafePromise } from '../sqlite-core/dialect.ts';
import { D1SQLTemplate } from './session.ts';

export interface D1SQL extends Omit<SQL, 'default' | 'unsafe'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): D1SQLTemplate<T>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		D1SQLTemplate<any>
	>;
}

export type AnyD1Database = IfNotImported<
	D1Database,
	MiniflareD1Database,
	D1Database | IfNotImported<MiniflareD1Database, never, MiniflareD1Database>
>;

const createSqlTemplate = <
	TClient extends AnyD1Database = AnyD1Database,
>(
	client: TClient,
	dialect: SqliteDialect,
): D1SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): D1SQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new D1SQLTemplate<T>(sql, client as D1Database, dialect);
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

			const unsafeDriver = new D1SQLTemplate(sql, client as D1Database, dialect, options);
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

export function waddler<TClient extends AnyD1Database = AnyD1Database>(
	{ client }: { client: TClient },
) {
	const dialect = new SqliteDialect();

	return createSqlTemplate(client as D1Database, dialect);
}
