import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../../types.ts';
import { PgDialect } from '../pg-core/dialect.ts';
import type { XataHttpClient } from './session.ts';
import { XataHttpSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: XataHttpClient,
	dialect: PgDialect,
): SQL => {
	// TODO: maybe it would be more efficient to create a SQLTemplate and SQLWrapper instances for unsafe func once here and then reuse them
	// const unsafeSql = new SQLWrapper();
	// const unsafeDriver = new XataHttpSQLTemplate(unsafeSql, client, dialect, options);

	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): XataHttpSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new XataHttpSQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new XataHttpSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler(
	{ client }: { client: XataHttpClient },
) {
	const dialect = new PgDialect();

	return createSqlTemplate(client, dialect);
}
