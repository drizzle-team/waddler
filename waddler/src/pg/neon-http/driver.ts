import type { HTTPTransactionOptions, NeonQueryFunction } from '@neondatabase/serverless';
import { neon } from '@neondatabase/serverless';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PgDialect, SQLFunctions } from '../pg-core/dialect.ts';
import type { NeonHttpClient } from './session.ts';
import { NeonHttpSQLTemplate } from './session.ts';

export interface NeonHttpSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new PgDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as NeonHttpSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

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
		...SQLFunctions,
		unsafe: async <RowMode extends 'object' | 'array'>(
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: RowMode },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' as RowMode };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new NeonHttpSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
	});

	return fn as any;
};

export function waddler<TClient extends NeonQueryFunction<any, any> = NeonQueryFunction<false, false>>(
	...params: [
		string,
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

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
