import { sql as vercelSql } from '@vercel/postgres';
import type { WaddlerConfigWithExtensions } from '../../extensions/index.ts';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { PgDialect, SQLFunctions } from '../../pg-core/dialect.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import type { VercelPgClient } from './session.ts';
import { VercelPgSQLTemplate } from './session.ts';

export interface VercelPgSQL extends SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): VercelPgSQLTemplate<T>;
}

const createSqlTemplate = (
	client: VercelPgClient,
	configOptions: WaddlerConfigWithExtensions = {},
): VercelPgSQL => {
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}
	const extensions = configOptions.extensions;

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): VercelPgSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new VercelPgSQLTemplate<T>(sql, client, dialect, { logger, extensions });
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

			const unsafeDriver = new VercelPgSQLTemplate(sql, client, dialect, { logger, extensions }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends VercelPgClient = typeof vercelSql>(
	...params: [] | [
		WaddlerConfigWithExtensions,
	] | [
		(
			& WaddlerConfigWithExtensions
			& ({
				client?: TClient;
			})
		),
	]
) {
	if (params[0] === undefined) {
		return createSqlTemplate(vercelSql, {});
	}

	if (isConfig(params[0])) {
		const { client, ...waddlerConfig } = params[0] as ({ client?: TClient } & WaddlerConfigWithExtensions);
		return createSqlTemplate(client ?? vercelSql, waddlerConfig);
	}

	return createSqlTemplate(vercelSql, params[0] as WaddlerConfigWithExtensions);
}
