import type { Client, PoolClient, PoolConfig } from 'pg';
import pg from 'pg';
import type { WaddlerConfigWithExtensions } from '../../extensions/index.ts';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PgDialect, SQLFunctions } from '../pg-core/dialect.ts';
import { NodePgSQLTemplate } from './session.ts';

export type NodePgClient = pg.Pool | PoolClient | Client;

export interface NodePgSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new PgDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as NodePgSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: NodePgClient,
	configOptions: WaddlerConfigWithExtensions = {},
): SQL => {
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}
	const extensions = configOptions.extensions;

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NodePgSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new NodePgSQLTemplate<T>(sql, client, dialect, { logger, extensions });
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

			const unsafeDriver = new NodePgSQLTemplate(sql, client, dialect, { logger, extensions }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends NodePgClient>(
	...params:
		| [
			string,
		]
		| [
			string,
			WaddlerConfigWithExtensions,
		]
		| [
			(
				& WaddlerConfigWithExtensions
				& ({
					connection: string | PoolConfig;
				} | {
					client: TClient;
				})
			),
		]
) {
	if (typeof params[0] === 'string') {
		const client = new pg.Pool({
			connectionString: params[0],
		});

		return createSqlTemplate(client, params[1] as WaddlerConfigWithExtensions);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...waddlerConfig } = params[0] as (
			& ({ connection?: PoolConfig | string; client?: TClient })
			& WaddlerConfigWithExtensions
		);

		if (client) return createSqlTemplate(client, waddlerConfig);

		const instance = typeof connection === 'string'
			? new pg.Pool({
				connectionString: connection,
			})
			: new pg.Pool(connection!);

		return createSqlTemplate(instance, waddlerConfig);
	}

	// TODO Change error message
	throw new Error(
		'Invalid parameter for waddler.'
			+ '\nMust be a string, { connection: string | pg.PoolConfig }, { client: pg.Client | pg.Pool }, pg.ClientConfig or pg.PoolConfig',
	);
}
