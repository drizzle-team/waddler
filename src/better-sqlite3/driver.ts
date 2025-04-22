import Client, { type Database, type Options } from 'better-sqlite3';
import type { SqliteIdentifierObject } from '~/sqlite-core';
import type { SQL } from '../sql';
import { SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import { SQLWrapper } from '../sql.ts';
import { SqliteDialect, UnsafePromise } from '../sqlite-core/dialect.ts';
import type { Identifier, Raw, RowData, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import { BetterSqlite3SQLTemplate } from './session.ts';

export interface BetterSqlite3SQL extends Omit<SQL, 'default' | 'unsafe'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): BetterSqlite3SQLTemplate<T>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		BetterSqlite3SQLTemplate<any>
	>;
}

const createSqlTemplate = (
	client: Database,
	dialect: SqliteDialect,
): BetterSqlite3SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): BetterSqlite3SQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// TODO: revise: this will return all integers as bigints
		// client.defaultSafeIntegers(true);
		return new BetterSqlite3SQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new BetterSqlite3SQLTemplate(sql, client, dialect, options);
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

export type BetterSQLite3DatabaseConfig =
	| ({
		source?:
			| string
			| Buffer;
	} & Options)
	| string
	| undefined;

export function waddler(
	...params:
		| []
		| [
			Database | string,
		]
		| [
			(({
				connection?: BetterSQLite3DatabaseConfig;
			} | {
				client: Database;
			})),
		]
) {
	const dialect = new SqliteDialect();

	if (params[0] === undefined || typeof params[0] === 'string') {
		const client = params[0] === undefined ? new Client() : new Client(params[0]);
		return createSqlTemplate(client, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: BetterSQLite3DatabaseConfig;
			client?: Database;
		};

		if (client) return createSqlTemplate(client, dialect);

		if (typeof connection === 'object') {
			const { source, ...options } = connection;

			const client = new Client(source, options);

			return createSqlTemplate(client, dialect);
		}

		const client_ = new Client(connection);

		return createSqlTemplate(client_, dialect);
	}

	return createSqlTemplate(params[0] as Database, dialect);
}
