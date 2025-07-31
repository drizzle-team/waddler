/// <reference types="bun-types" />
import { Database } from 'bun:sqlite';
import type { SQLIdentifier } from '../../sql-template-params.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, RowData, SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { SQLFunctions, SqliteDialect, UnsafePromise } from '../sqlite-core/dialect.ts';
import type { SqliteIdentifierObject } from '../sqlite-core/index.ts';
import { BunSqliteSQLTemplate } from './session.ts';

export interface BunSqliteSQL extends Omit<SQL, 'default' | 'unsafe' | 'identifier'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): BunSqliteSQLTemplate<T>;
	identifier(value: Identifier<SqliteIdentifierObject>): SQLIdentifier<SqliteIdentifierObject>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		BunSqliteSQLTemplate<any>
	>;
}

export interface BunSqlite3SQLQuery extends Pick<SQL, 'raw' | 'values'>, Pick<BunSqliteSQL, 'identifier'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new SqliteDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as BunSqlite3SQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: Database,
	dialect: SqliteDialect,
): BunSqliteSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): BunSqliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// client.defaultSafeIntegers(true);
		return new BunSqliteSQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new BunSqliteSQLTemplate(sql, client, dialect, options);
			const unsafePromise = new UnsafePromise(unsafeDriver);

			return unsafePromise;
		},
		// get default() {
		// 	throw new Error(`sql.default is not implemented for sqlite.`);
		// },
	});

	return fn as any;
};

type BunSqliteDatabaseOptions = {
	/**
	 * Open the database as read-only (no write operations, no create).
	 *
	 * Equivalent to {@link constants.SQLITE_OPEN_READONLY}
	 */
	readonly?: boolean;
	/**
	 * Allow creating a new database
	 *
	 * Equivalent to {@link constants.SQLITE_OPEN_CREATE}
	 */
	create?: boolean;
	/**
	 * Open the database as read-write
	 *
	 * Equivalent to {@link constants.SQLITE_OPEN_READWRITE}
	 */
	readwrite?: boolean;
};

export type BunSqliteDatabaseConfig =
	| ({
		source?: string;
	} & BunSqliteDatabaseOptions)
	| string
	| undefined;

export function waddler<TClient extends Database = Database>(
	...params:
		| []
		| [
			string,
		]
		| [
			(
				({
					connection?: BunSqliteDatabaseConfig;
				} | {
					client: TClient;
				})
			),
		]
) {
	const dialect = new SqliteDialect();

	if (params[0] === undefined || typeof params[0] === 'string') {
		const client = params[0] === undefined ? new Database() : new Database(params[0]);
		return createSqlTemplate(client, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: BunSqliteDatabaseConfig | string;
			client?: TClient;
		};

		if (client) return createSqlTemplate(client, dialect);

		if (typeof connection === 'object') {
			const { source, ...opts } = connection;

			const options = Object.values(opts).filter((v) => v !== undefined).length ? opts : undefined;

			const client = new Database(source, options);

			return createSqlTemplate(client, dialect);
		}

		const client_ = new Database(connection);

		return createSqlTemplate(client_, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
