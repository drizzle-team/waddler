import type { HTTPTransactionOptions, NeonQueryFunction } from '@neondatabase/serverless';
import { neon } from '@neondatabase/serverless';
import { PgDialect } from '../pg-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import type { NeonAuthToken, NeonHttpClient } from './session.ts';
import { NeonHttpSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: NeonHttpClient,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): NeonHttpSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new NeonHttpSQLTemplate<T>(sql, client, dialect);
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
			options?: { rowMode: 'array' | 'object'; token?: NeonAuthToken }, // TODO: should token be in options?
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new NeonHttpSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends NeonQueryFunction<any, any> = NeonQueryFunction<false, false>>(
	...params: [
		TClient | string,
	] | [
		TClient | string,
	] | [
		(
			({
				connection: string | ({ connectionString: string } & HTTPTransactionOptions<boolean, boolean>);
			} | {
				client: TClient;
			})
		),
	]
) {
	const dialect = new PgDialect();

	if (typeof params[0] === 'string') {
		const instance = neon(params[0] as string);
		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?:
				| ({
					connectionString: string;
				} & HTTPTransactionOptions<boolean, boolean>)
				| string;
			client?: TClient;
		};

		if (client) return createSqlTemplate(client, dialect);

		if (typeof connection === 'object') {
			const { connectionString, ...options } = connection;

			const instance = neon(connectionString, options);

			return createSqlTemplate(instance, dialect);
		}

		const instance = neon(connection!);

		return createSqlTemplate(instance, dialect);
	}

	return createSqlTemplate(params[0] as TClient, dialect);
}
