import type { PGliteOptions } from '@electric-sql/pglite';
import { PGlite } from '@electric-sql/pglite';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PgDialect, SQLFunctions } from '../pg-core/dialect.ts';
import { PGliteSQLTemplate } from './session.ts';

export interface PGliteSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new PgDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as PGliteSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: PGlite,
	configOptions: WaddlerConfig = {},
): SQL => {
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): PGliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new PGliteSQLTemplate<T>(sql, client, dialect, { logger });
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

			const unsafeDriver = new PGliteSQLTemplate(sql, client, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends PGlite = PGlite>(
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
					connection?: (PGliteOptions & { dataDir?: string }) | string;
				} | {
					client: TClient;
				})
			),
		]
) {
	if (params[0] === undefined || typeof params[0] === 'string') {
		const client = new PGlite(params[0]);
		return createSqlTemplate(client, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as (
			& ({
				connection?: PGliteOptions & { dataDir: string };
				client?: TClient;
			})
			& WaddlerConfig
		);

		if (client) return createSqlTemplate(client, configOptions);

		if (typeof connection === 'object') {
			const { dataDir, ...options } = connection;

			const client = new PGlite(dataDir, options);

			return createSqlTemplate(client, configOptions);
		}

		const client_ = new PGlite(connection);

		return createSqlTemplate(client_, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
