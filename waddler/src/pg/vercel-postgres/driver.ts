import { sql as vercelSql } from '@vercel/postgres';
import type { WaddlerConfig } from '../../extensions/index.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PgDialect, SQLFunctions } from '../pg-core/dialect.ts';
import type { VercelPgClient } from './session.ts';
import { VercelPgSQLTemplate } from './session.ts';

export interface VercelPgSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new PgDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as VercelPgSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: VercelPgClient,
	configOptions: WaddlerConfig,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): VercelPgSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new VercelPgSQLTemplate<T>(sql, client, dialect, configOptions);
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
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new VercelPgSQLTemplate(sql, client, dialect, configOptions, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends VercelPgClient = typeof vercelSql>(
	...params: [] | [
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				client?: TClient;
			})
		),
	]
) {
	const dialect = new PgDialect();
	if (params[0] === undefined) {
		return createSqlTemplate(vercelSql, {}, dialect);
	}

	if (isConfig(params[0])) {
		const { client, ...waddlerConfig } = params[0] as ({ client?: TClient } & WaddlerConfig);
		return createSqlTemplate(client ?? vercelSql, waddlerConfig, dialect);
	}

	return createSqlTemplate(vercelSql, params[0] as WaddlerConfig, dialect);
}
