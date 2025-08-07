import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqliteIdentifierObject } from '~/sqlite/sqlite-core/index.ts';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import type { SQLIdentifier } from '../../sql-template-params.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { SQLFunctions, SqliteDialect, UnsafePromise } from '../sqlite-core/dialect.ts';
import { ExpoSqliteSQLTemplate } from './session.ts';

export interface ExpoSqliteSQL extends Omit<SQL, 'default' | 'unsafe' | 'identifier'> {
	/**
	 * sql.default is not implemented for sqlite because sqlite doesn't support feature of specifying 'default' keyword in insert statements.
	 */
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): ExpoSqliteSQLTemplate<T>;
	identifier(value: Identifier<SqliteIdentifierObject>): SQLIdentifier<SqliteIdentifierObject>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		ExpoSqliteSQLTemplate<any>
	>;
}

export interface ExpoSqliteSQLQuery extends Pick<SQL, 'raw' | 'values'>, Pick<ExpoSqliteSQL, 'identifier'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new SqliteDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as ExpoSqliteSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: SQLiteDatabase,
	configOptions: WaddlerConfig = {},
): ExpoSqliteSQL => {
	const dialect = new SqliteDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): ExpoSqliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// client.defaultSafeIntegers(true);
		return new ExpoSqliteSQLTemplate<T>(sql, client, dialect, { logger });
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

			const unsafeDriver = new ExpoSqliteSQLTemplate(sql, client, dialect, { logger }, options);
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

export function waddler({ client, config }: { client: SQLiteDatabase; config?: WaddlerConfig }) {
	return createSqlTemplate(client, config);
}
