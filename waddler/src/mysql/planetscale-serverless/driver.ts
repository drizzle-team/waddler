import type { Config } from '@planetscale/database';
import { Client } from '@planetscale/database';
import type { Logger } from '../../logger.ts';
import { DefaultLogger } from '../../logger.ts';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType, WaddlerConfig } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { MySQLDialect, SQLFunctions } from '../mysql-core/dialect.ts';
import { PlanetscaleServerlessSQLTemplate } from './session.ts';

export interface PlanetscaleServerlessSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new MySQLDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as PlanetscaleServerlessSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

const createSqlTemplate = (
	client: Client,
	configOptions: WaddlerConfig = {},
): SQL => {
	const dialect = new MySQLDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): PlanetscaleServerlessSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new PlanetscaleServerlessSQLTemplate<T>(sql, client, dialect, { logger });
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

			const unsafeDriver = new PlanetscaleServerlessSQLTemplate(sql, client, dialect, { logger }, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends Client = Client>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | Config;
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const instance = new Client({
			url: params[0],
		});

		return createSqlTemplate(instance, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } =
			params[0] as ({ connection?: Config | string; client?: TClient } & WaddlerConfig);

		if (client) return createSqlTemplate(client, configOptions);

		const instance = typeof connection === 'string'
			? new Client({
				url: connection,
			})
			: new Client(
				connection!,
			);

		return createSqlTemplate(instance, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
