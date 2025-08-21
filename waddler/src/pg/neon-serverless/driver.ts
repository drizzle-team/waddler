import type { PoolConfig } from '@neondatabase/serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import type { WaddlerConfigWithExtensions } from '../../extensions/index.ts';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { PgDialect, SQLFunctions } from '../../pg-core/dialect.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import type { NeonClient } from './session.ts';
import { NeonServerlessSQLTemplate } from './session.ts';

export interface NeonServerlessSQL extends SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): NeonServerlessSQLTemplate<T>;
}

const createSqlTemplate = (
	client: NeonClient,
	configOptions: WaddlerConfigWithExtensions = {},
): NeonServerlessSQL => {
	const dialect = new PgDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}
	const extensions = configOptions.extensions;

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NeonServerlessSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new NeonServerlessSQLTemplate<T>(sql, client, dialect, { logger, extensions });
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

			const unsafeDriver = new NeonServerlessSQLTemplate(sql, client, dialect, { logger, extensions }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends NeonClient = Pool>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfigWithExtensions,
	] | [
		(
			& WaddlerConfigWithExtensions
			& ({
				connection: string | PoolConfig;
			} | {
				client: TClient;
			})
			& {
				ws?: any;
			}
		),
	]
) {
	if (typeof params[0] === 'string') {
		const instance = new Pool({
			connectionString: params[0],
		});

		return createSqlTemplate(instance, params[1] as WaddlerConfigWithExtensions);
	}

	if (isConfig(params[0])) {
		const { connection, client, ws, ...waddlerConfig } = params[0] as (
			& ({
				connection?: PoolConfig | string;
				ws?: any;
				client?: TClient;
			})
			& WaddlerConfigWithExtensions
		);

		if (ws) {
			neonConfig.webSocketConstructor = ws;
		}

		if (client) return createSqlTemplate(client, waddlerConfig);

		const instance = typeof connection === 'string'
			? new Pool({
				connectionString: connection,
			})
			: new Pool(connection);

		return createSqlTemplate(instance, waddlerConfig);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
