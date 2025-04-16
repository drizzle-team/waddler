/// <reference types="bun-types" />
import { Database } from 'bun:sqlite';
import type { SQL } from '../sql';
import { SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import { SQLWrapper } from '../sql.ts';
import type { SqliteIdentifierObject } from '../sqlite-core';
import { SqliteDialect } from '../sqlite-core/dialect.ts';
import type { Identifier, Raw, RowData, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import { BunSqliteSQLTemplate } from './session.ts';

export interface BunSqliteSQL extends Omit<SQL, 'default' | 'unsafe'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): BunSqliteSQLTemplate<T>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		}
	>;
}

class UnsafePromise<T> {
	constructor(private driver: BunSqliteSQLTemplate<T>) {}

	run(): Omit<UnsafePromise<T>, 'run' | 'all'> {
		this.driver.run();
		return this;
	}

	all(): Omit<UnsafePromise<T>, 'run' | 'all'> {
		this.driver.all();
		return this;
	}

	stream() {
		return this.driver.stream();
	}

	// Allow it to be awaited (like a Promise)
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?:
			| ((value: T[]) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined,
	): Promise<TResult1 | TResult2> {
		// Here you could handle the query execution logic (replace with your own)
		const result = this.driver.execute();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}
}

const createSqlTemplate = (
	client: Database,
	dialect: SqliteDialect,
): BunSqliteSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): BunSqliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// TODO: revise: this will return all integers as bigints
		// client.defaultSafeIntegers(true);
		return new BunSqliteSQLTemplate<T>(sql, client, dialect);
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
			TClient | string,
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

	return createSqlTemplate(params[0] as Database, dialect);
}
