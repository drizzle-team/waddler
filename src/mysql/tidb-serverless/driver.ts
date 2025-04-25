import type { Config, Connection } from '@tidbcloud/serverless';
import { connect } from '@tidbcloud/serverless';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, Raw, SQLParamType, UnsafeParamType, Values } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import type { MySQLIdentifierObject } from '../mysql-core/dialect.ts';
import { MySQLDialect } from '../mysql-core/dialect.ts';
import { TidbServerlessSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: Connection,
	dialect: MySQLDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): TidbServerlessSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new TidbServerlessSQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new TidbServerlessSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends Connection = Connection>(
	...params: [
		string,
	] | [
		({
			connection: string | Config;
		} | {
			client: TClient;
		}),
	]
) {
	const dialect = new MySQLDialect();

	if (typeof params[0] === 'string') {
		const instance = connect({
			url: params[0],
		});

		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as { connection?: Config | string; client?: TClient };

		if (client) return createSqlTemplate(client, dialect);

		const instance = typeof connection === 'string'
			? connect({
				url: connection,
			})
			: connect(connection!);

		return createSqlTemplate(instance, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
