import pg, { type Client, type Pool, PoolClient, PoolConfig } from 'pg';
import { WaddlerConfig, WaddlerDriverExtension } from '~/extensions.ts';
import type { PgIdentifierObject, PgValues } from '../pg-core/dialect.ts';
import type { Identifier, Raw } from '../sql-template-params.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { RowData } from '../types.ts';
import { NodePgSQLTemplate } from './sql-template.ts';
import type { NodePgSQLParamType, UnsafeParamType } from './types.ts';
import { dbQuery, isConfig } from './utils.ts';

export interface SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: NodePgSQLParamType[]): NodePgSQLTemplate<T>;
	identifier(value: Identifier<PgIdentifierObject>): SQLIdentifier<PgIdentifierObject>;
	values(value: PgValues): SQLValues<PgValues>;
	raw(value: Raw): SQLRaw;
	unsafe<RowMode extends 'array' | 'object' = 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): Promise<
		RowMode extends 'array' ? any[][] : {
			[columnName: string]: any;
		}[]
	>;
	default: SQLDefault;
}

const createSqlTemplate = (
	client: NodePgClient,
	configOptions: WaddlerConfig,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: NodePgSQLParamType[]): NodePgSQLTemplate<T> => {
		return new NodePgSQLTemplate<T>(strings, params, client, configOptions);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<PgIdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: PgValues) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: async (query: string, params?: UnsafeParamType[], options?: { rowMode?: 'array' | 'object' }) => {
			options = options ?? {};
			options.rowMode = options.rowMode ?? 'object';

			params = params ?? [];

			return await unsafeFunc(
				client,
				query,
				params,
				{ ...options as Required<typeof options> },
			);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

const unsafeFunc = async (
	client: NodePgClient,
	query: string,
	params: UnsafeParamType[],
	options: { rowMode: 'array' | 'object' },
) => {
	let result;

	// wrapping node-postgres driver error in new js error to add stack trace to it
	try {
		result = await dbQuery(
			client,
			query,
			params,
			options,
		);
	} catch (error) {
		const newError = error instanceof AggregateError
			? new Error(error.errors.map((e) => e.message).join('\n'))
			: new Error((error as Error).message);
		throw newError;
	}

	return result;
};
export type NodePgClient = pg.Pool | PoolClient | Client;

export function waddler<TClient extends NodePgClient>(
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

		return createSqlTemplate(client, params[1] as WaddlerConfig);
	}

	if (isConfig(params)) {
		const { connection, client, ...waddlerConfig } = params[0] as (
			& ({ connection?: PoolConfig | string; client?: TClient })
			& WaddlerConfig
		);

		if (client) return createSqlTemplate(client, waddlerConfig);

		const instance = typeof connection === 'string'
			? new pg.Pool({
				connectionString: connection,
			})
			: new pg.Pool(connection!);

		return createSqlTemplate(instance, waddlerConfig);
	}

	// Change error message
	throw new Error(
		'Invalid parameter for waddler.'
			+ '\nMust be a string, pg.Client, pg.Pool, { connection: string | pg.PoolConfig }, { client: pg.Client | pg.Pool }, pg.ClientConfig or pg.PoolConfig',
	);
}
