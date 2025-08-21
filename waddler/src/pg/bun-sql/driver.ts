/// <reference types="bun-types" />
import type { SQLOptions } from 'bun';
import { SQL as BunSql } from 'bun';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { PgDialect, SQLFunctions } from '../../pg-core/dialect.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { BunSqlSQLTemplate } from './session.ts';

export interface BunSqlSQL extends SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): BunSqlSQLTemplate<T>;
}

const createSqlTemplate = (
	client: BunSql,
	configOptions: WaddlerConfig = {},
): BunSqlSQL => {
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): BunSqlSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new BunSqlSQLTemplate<T>(sql, client, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: async <RowMode extends 'array' | 'object'>(
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: RowMode },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' as RowMode };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new BunSqlSQLTemplate(sql, client, dialect, { logger }, options);

			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends BunSql = BunSql>(
	...params:
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
					connection: string | ({ url?: string } & SQLOptions);
				} | {
					client: TClient;
				})
			),
		]
) {
	if (typeof params[0] === 'string') {
		const instance = new BunSql(params[0]);

		return createSqlTemplate(instance, params[1] as WaddlerConfig);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...waddlerConfig } = params[0] as
			& ({
				connection?: { url?: string } & SQLOptions;
				client?: TClient;
			})
			& WaddlerConfig;

		if (client) return createSqlTemplate(client, waddlerConfig);

		if (typeof connection === 'object' && connection.url !== undefined) {
			const { url, ...config } = connection;

			const instance = new BunSql({ url, ...config });
			return createSqlTemplate(instance, waddlerConfig);
		}

		const instance = new BunSql(connection);
		return createSqlTemplate(instance, waddlerConfig);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
