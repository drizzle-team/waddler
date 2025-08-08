import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { PgDialect, SQLFunctions } from '../pg-core/dialect.ts';
import type { XataHttpClient } from './session.ts';
import { XataHttpSQLTemplate } from './session.ts';

export interface XataHttpSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new PgDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as XataHttpSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: XataHttpClient,
	configOptions: WaddlerConfig = {},
): SQL => {
	// TODO: maybe it would be more efficient to create a SQLTemplate and SQLWrapper instances for unsafe func once here and then reuse them
	// const unsafeSql = new SQLWrapper();
	// const unsafeDriver = new XataHttpSQLTemplate(unsafeSql, client, dialect, options);
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): XataHttpSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new XataHttpSQLTemplate<T>(sql, client, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: async (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new XataHttpSQLTemplate(sql, client, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler(
	{ client, config }: { client: XataHttpClient; config?: WaddlerConfig },
) {
	return createSqlTemplate(client, config);
}
