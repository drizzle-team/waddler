import type { Options, PostgresType, Sql } from 'postgres';
import postgres from 'postgres';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { PgDialect, SQLFunctions } from '../../pg-core/dialect.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PostgresSQLTemplate } from './session.ts';

export interface PostgresSQL extends SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): PostgresSQLTemplate<T>;
}

const createSqlTemplate = (
	client: Sql,
	configOptions: WaddlerConfig = {},
): PostgresSQL => {
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): PostgresSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new PostgresSQLTemplate<T>(sql, client, dialect, { logger });
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

			const unsafeDriver = new PostgresSQLTemplate(sql, client, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends Sql>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | ({ url?: string } & Options<Record<string, PostgresType>>);
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const client = postgres(params[0] as string);

		return createSqlTemplate(client, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as (
			& WaddlerConfig
			& ({
				connection?: { url?: string } & Options<Record<string, PostgresType>>;
				client?: TClient;
			})
		);

		if (client) return createSqlTemplate(client, configOptions);

		if (typeof connection === 'object' && connection.url !== undefined) {
			const { url, ...config } = connection;

			const client = postgres(url, config);
			return createSqlTemplate(client, configOptions);
		}

		const client_ = postgres(connection);
		return createSqlTemplate(client_, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
