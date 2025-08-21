/// <reference types="@cloudflare/workers-types" />

import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import { SQLFunctions, SqliteDialect, UnsafePromise } from '../../sqlite-core/dialect.ts';
import type { SqliteSQL } from '../../sqlite-core/dialect.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { DurableSqliteSQLTemplate } from './session.ts';

export interface DurableSqliteSQL extends Omit<SQL, 'default' | 'unsafe' | 'identifier'>, SqliteSQL {
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
	configOptions: WaddlerConfig = {},
): DurableSqliteSQL => {
	const dialect = new SqliteDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): DurableSqliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		// client.defaultSafeIntegers(true);
		return new DurableSqliteSQLTemplate<T>(sql, client, dialect, { logger });
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

			const unsafeDriver = new DurableSqliteSQLTemplate(sql, client, dialect, { logger }, options);
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
	{ client, config }: { client: TClient; config?: WaddlerConfig },
) {
	return createSqlTemplate(client, config);
}
