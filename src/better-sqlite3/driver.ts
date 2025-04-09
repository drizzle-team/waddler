import { SQL, SQLWrapper, Values } from '~/sql';
import { Identifier, Raw, SQLIdentifier, SQLRaw, SQLValues } from '~/sql-template-params';
import { SqliteDialect, SqliteIdentifierObject } from '~/sqlite-core';
import type { UnsafeParamType } from '../types.ts';

const createSqlTemplate = (
	client: Pool | Connection,
	dialect: SqliteDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): MySql2SQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new MySql2SQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<SqliteIdentifierObject>) => {
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

			const unsafeDriver = new MySql2SQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

type MySql2Client = Pool | Connection | CallbackPool | CallbackConnection;

export function waddler<TClient extends MySql2Client>(
	...params: []
) {
	const dialect = new SqliteDialect();
}
