import type { Client, PoolClient, PoolConfig } from 'pg';
import pg from 'pg';
import type { WaddlerConfig } from '../extensions.ts';
import { PgDialect } from '../pg-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import { NodePgSQLTemplate } from './session.ts';

export type NodePgClient = pg.Pool | PoolClient | Client;

const createSqlTemplate = (
	client: NodePgClient,
	configOptions: WaddlerConfig,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NodePgSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new NodePgSQLTemplate<T>(sql, client, dialect, configOptions);
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

			const unsafeDriver = new NodePgSQLTemplate(sql, client, dialect, configOptions, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
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
	const dialect = new PgDialect();

	if (typeof params[0] === 'string') {
		const client = new pg.Pool({
			connectionString: params[0],
		});

		return createSqlTemplate(client, params[1] as WaddlerConfig, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...waddlerConfig } = params[0] as (
			& ({ connection?: PoolConfig | string; client?: TClient })
			& WaddlerConfig
		);

		if (client) return createSqlTemplate(client, waddlerConfig, dialect);

		const instance = typeof connection === 'string'
			? new pg.Pool({
				connectionString: connection,
			})
			: new pg.Pool(connection!);

		return createSqlTemplate(instance, waddlerConfig, dialect);
	}

	// Change error message
	throw new Error(
		'Invalid parameter for waddler.'
			+ '\nMust be a string, pg.Client, pg.Pool, { connection: string | pg.PoolConfig }, { client: pg.Client | pg.Pool }, pg.ClientConfig or pg.PoolConfig',
	);
}
