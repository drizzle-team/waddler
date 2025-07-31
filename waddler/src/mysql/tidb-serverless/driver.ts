import type { Config, Connection } from '@tidbcloud/serverless';
import { connect } from '@tidbcloud/serverless';
import { SQLQuery } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { SQLParamType, UnsafeParamType } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { MySQLDialect, SQLFunctions } from '../mysql-core/dialect.ts';
import { TidbServerlessSQLTemplate } from './session.ts';

export interface TidbServerlessSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new MySQLDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as TidbServerlessSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };

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

			const unsafeDriver = new TidbServerlessSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
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
