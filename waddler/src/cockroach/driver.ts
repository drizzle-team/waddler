import type { Client, PoolClient, PoolConfig } from 'pg';
import pg from 'pg';
import type { CockroachCoreSQL } from '../cockroach-core/dialect.ts';
import { CockroachDialect, CockroachSQLCommonParam, SQLFunctions } from '../cockroach-core/dialect.ts';
import type { WaddlerConfigWithExtensions } from '../extensions/index.ts';
import type { Logger } from '../logger.ts';
import { DefaultLogger } from '../logger.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType } from '../types.ts';
import { isConfig } from '../utils.ts';
import { CockroachSQLTemplate } from './session.ts';

export interface CockroachSQL extends Omit<SQL, 'values'>, CockroachCoreSQL {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): CockroachSQLTemplate<T>;
}

export type CockroachClient = pg.Pool | PoolClient | Client;

const createSqlTemplate = (
	client: CockroachClient,
	configOptions: WaddlerConfigWithExtensions = {},
): CockroachSQL => {
	const dialect = new CockroachDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}
	const extensions = configOptions.extensions;

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): CockroachSQLTemplate<T> => {
		const sqlWrapper = new SQLWrapper();
		sqlWrapper.setOverrides({ SQLCommonParam: CockroachSQLCommonParam });
		sqlWrapper.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new CockroachSQLTemplate<T>(sqlWrapper, client, dialect, { logger, extensions });
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

			const sqlWrapper = new SQLWrapper();
			sqlWrapper.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new CockroachSQLTemplate(sqlWrapper, client, dialect, { logger, extensions }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends CockroachClient>(
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
