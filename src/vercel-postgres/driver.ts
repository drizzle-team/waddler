import { sql as vercelSql } from '@vercel/postgres';
import type { WaddlerConfig } from '../extensions.ts';
import { PgDialect } from '../pg-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import type { VercelPgClient } from './session.ts';
import { VercelPgSQLTemplate } from './session.ts';

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
		identifier: (value: Identifier<IdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
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
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends VercelPgClient = typeof vercelSql>(
	...params: [] | [
		TClient,
	] | [
		TClient,
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

	if (isConfig(params[0])) {
		const { client, ...waddlerConfig } = params[0] as ({ client?: TClient } & WaddlerConfig);
		return createSqlTemplate(client ?? vercelSql, waddlerConfig, dialect);
	}

	return createSqlTemplate((params[0] ?? vercelSql) as TClient, params[1] as WaddlerConfig, dialect);
}
