import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config';
import {
	ClickHouseDialect,
	ClickHouseSQLCommonParam,
	SQLFunctions,
	UnsafePromise,
} from '../clickhouse-core/dialect.ts';
import type { ClickHouseCoreSQL } from '../clickhouse-core/dialect.ts';
import type { Logger } from '../logger.ts';
import { DefaultLogger } from '../logger.ts';
import { type SQL, SQLWrapper } from '../sql.ts';
import type { RowData, SQLParamType, UnsafeParamType, WaddlerConfig } from '../types.ts';
import { isConfig } from '../utils.ts';
import { ClickHouseSQLTemplate } from './session.ts';

export interface ClickHouseSQL extends Omit<SQL, 'unsafe' | 'values'>, ClickHouseCoreSQL {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): ClickHouseSQLTemplate<T>;

	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: Record<string, UnsafeParamType>,
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		ClickHouseSQLTemplate<any>
	>;
}

const createSqlTemplate = (
	client: ClickHouseClient,
	configOptions: WaddlerConfig = {},
): ClickHouseSQL => {
	const dialect = new ClickHouseDialect();
	let logger: Logger | undefined;
	if (configOptions.logger === true) {
		logger = new DefaultLogger();
	} else if (configOptions.logger !== false) {
		logger = configOptions.logger;
	}

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): ClickHouseSQLTemplate<T> => {
		const sqlWrapper = new SQLWrapper();
		sqlWrapper.setOverrides({ SQLCommonParam: ClickHouseSQLCommonParam });
		sqlWrapper.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new ClickHouseSQLTemplate<T>(sqlWrapper, client, dialect, { logger });
	};

	Object.assign(fn, {
		...SQLFunctions,
		unsafe: (
			query: string,
			params?: Record<string, UnsafeParamType>,
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? {};
			options = options ?? { rowMode: 'object' };

			const sqlWrapper = new SQLWrapper();
			sqlWrapper.with({ rawParams: { sql: query, params } });

			const unsafeDriver = new ClickHouseSQLTemplate(sqlWrapper, client, dialect, { logger }, options);
			const unsafePromise = new UnsafePromise(unsafeDriver);

			return unsafePromise;
		},
	});

	return fn as any;
};

export function waddler<TClient extends ClickHouseClient>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | NodeClickHouseClientConfigOptions;
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const connectionString = params[0]!;
		const pool = createClient({
			url: connectionString,
		});

		return createSqlTemplate(pool, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } = params[0] as ({
			connection?: NodeClickHouseClientConfigOptions | string;
			client?: TClient;
		} & WaddlerConfig);

		if (client) {
			return createSqlTemplate(client, configOptions);
		}

		const client_ = typeof connection === 'string'
			? createClient({
				url: connection,
			})
			: createClient(connection!);

		return createSqlTemplate(client_, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
