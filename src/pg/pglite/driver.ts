import type { PGliteOptions } from '@electric-sql/pglite';
import { PGlite } from '@electric-sql/pglite';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { SQL } from '../../sql.ts';
import { SQLWrapper } from '../../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../../types.ts';
import { isConfig } from '../../utils.ts';
import { PgDialect } from '../pg-core/dialect.ts';
import { PGliteSQLTemplate } from './session.ts';

const createSqlTemplate = (
	client: PGlite,
	dialect: PgDialect,
): SQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): PGliteSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new PGliteSQLTemplate<T>(sql, client, dialect);
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

			const unsafeDriver = new PGliteSQLTemplate(sql, client, dialect, options);
			return await unsafeDriver.execute();
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends PGlite = PGlite>(
	...params:
		| []
		| [
			string,
		]
		| [
			(
				({
					connection?: (PGliteOptions & { dataDir?: string }) | string;
				} | {
					client: TClient;
				})
			),
		]
) {
	const dialect = new PgDialect();

	if (params[0] === undefined || typeof params[0] === 'string') {
		const client = new PGlite(params[0]);
		return createSqlTemplate(client, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: PGliteOptions & { dataDir: string };
			client?: TClient;
		};

		if (client) return createSqlTemplate(client, dialect);

		if (typeof connection === 'object') {
			const { dataDir, ...options } = connection;

			const client = new PGlite(dataDir, options);

			return createSqlTemplate(client, dialect);
		}

		const client_ = new PGlite(connection);

		return createSqlTemplate(client_, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
