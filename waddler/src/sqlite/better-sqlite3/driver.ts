import Client, { type Database, type Options } from 'better-sqlite3';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SqliteSQL } from '../../sqlite-core/dialect.ts';
import { SQLFunctions, SqliteDialect, UnsafePromise } from '../../sqlite-core/dialect.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { BetterSqlite3SQLTemplate } from './session.ts';

export interface BetterSqlite3SQL extends Omit<SQL, 'default' | 'unsafe' | 'identifier'>, SqliteSQL {
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
	configOptions: WaddlerConfig = {},
): BetterSqlite3SQL => {
	const dialect = new SqliteDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): BetterSqlite3SQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// client.defaultSafeIntegers(true);
		return new BetterSqlite3SQLTemplate<T>(sql, client, dialect, { logger });
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
			sql.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new BetterSqlite3SQLTemplate(sql, client, dialect, { logger }, options);
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
			string,
		]
		| [
			string,
			WaddlerConfig,
		]
		| [
			(
				& WaddlerConfig
				& ({
					connection?: BetterSQLite3DatabaseConfig;
				} | {
					client: Database;
				})
			),
		]
) {
	if (params[0] === undefined || typeof params[0] === 'string') {
		const client = params[0] === undefined ? new Client() : new Client(params[0]);
		return createSqlTemplate(client, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as ({
			connection?: BetterSQLite3DatabaseConfig;
			client?: Database;
		} & WaddlerConfig);

		if (client) return createSqlTemplate(client, configOptions);

		if (typeof connection === 'object') {
			const { source, ...options } = connection;

			const client = new Client(source, options);

			return createSqlTemplate(client, configOptions);
		}

		const client_ = new Client(connection);

		return createSqlTemplate(client_, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
