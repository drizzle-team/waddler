import type { Config } from '@planetscale/database';
import { Client } from '@planetscale/database';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, Raw, SQLParamType, UnsafeParamType, Values } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import type { MySQLIdentifierObject } from '../mysql-core/dialect.ts';
import { MySQLDialect } from '../mysql-core/dialect.ts';
import { PlanetscaleServerlessSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: Client,
	dialect: MySQLDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): PlanetscaleServerlessSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new PlanetscaleServerlessSQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<MySQLIdentifierObject>) => {
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

			const unsafeDriver = new PlanetscaleServerlessSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends Client = Client>(
	...params: [
		string,
	] | [
		(({
			connection: string | Config;
		} | {
			client: TClient;
		})),
	]
) {
	const dialect = new MySQLDialect();

	if (typeof params[0] === 'string') {
		const instance = new Client({
			url: params[0],
		});

		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as { connection?: Config | string; client?: TClient };

		if (client) return createSqlTemplate(client, dialect);

		const instance = typeof connection === 'string'
			? new Client({
				url: connection,
			})
			: new Client(
				connection!,
			);

		return createSqlTemplate(instance, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
