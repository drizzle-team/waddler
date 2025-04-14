import type { PoolConfig } from '@neondatabase/serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { PgDialect } from '../pg-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import type { NeonClient } from './session.ts';
import { NeonServerlessSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: NeonClient,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NeonServerlessSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new NeonServerlessSQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new NeonServerlessSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends NeonClient = Pool>(
	...params: [
		TClient | string,
	] | [
		(
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
	const dialect = new PgDialect();

	if (typeof params[0] === 'string') {
		const instance = new Pool({
			connectionString: params[0],
		});

		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client, ws } = params[0] as {
			connection?: PoolConfig | string;
			ws?: any;
			client?: TClient;
		};

		if (ws) {
			neonConfig.webSocketConstructor = ws;
		}

		if (client) return createSqlTemplate(client, dialect);

		const instance = typeof connection === 'string'
			? new Pool({
				connectionString: connection,
			})
			: new Pool(connection);

		return createSqlTemplate(instance, dialect);
	}

	return createSqlTemplate(params[0] as TClient, dialect);
}
