import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '~/sql-template-params.ts';
import { isConfig } from '~/utils.ts';
import type { DbType } from '../clickhouse-core/index.ts';
import { ClickHouseDialect, UnsafePromise } from '../clickhouse-core/index.ts';
import { type SQL, SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, RowData, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { ClickHouseSQLTemplate } from './session.ts';

export interface ClickHouseSQL extends Omit<SQL, 'unsafe' | 'values'> {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): ClickHouseSQLTemplate<T>;

	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		ClickHouseSQLTemplate<any>
	>;

	/**
	 * @param values - A two-dimensional array of rows to insert; each inner array represents one row of values.
	 * @param types - (Optional) An array of ClickHouse data types (e.g. ['Int32', 'String']) used to cast each column value.
	 *
	 * If omitted, or if there are fewer types than columns, any missing types default to 'String'.
	 *
	 * For full list of types, see https://clickhouse.com/docs/sql-reference/data-types
	 *
	 * @example
	 * ```ts
	 * const rows = [
	 *   [1, 'qwerty1'],
	 *   [2, 'qwerty2']
	 * ];
	 * const types = ['Int32', 'String'];
	 *
	 * sql`INSERT INTO <tableIdentifier> VALUES ${sql.values(rows, types)};`
	 * ```
	 *
	 * This generates and executes:
	 *
	 * ```sql
	 * INSERT INTO <tableIdentifier>
	 * VALUES ({val1:Int32}, {val2:String}), ({val3:Int32}, {val4:String});
	 * ```
	 *
	 * with these query parameters:
	 * ```ts
	 * {
	 *   val1: 1,
	 *   val2: 'qwerty1',
	 *   val3: 2,
	 *   val4: 'qwerty2'
	 * }
	 * ```
	 */
	values(value: Values, types?: DbType[]): SQLValues;
}

const createSqlTemplate = (
	client: ClickHouseClient,
	dialect: ClickHouseDialect,
): ClickHouseSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): ClickHouseSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new ClickHouseSQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<IdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values, types?: DbType[]) => {
			return new SQLValues(value, types);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new ClickHouseSQLTemplate(sql, client, dialect, options);
			const unsafePromise = new UnsafePromise(unsafeDriver);

			return unsafePromise;
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler<TClient extends ClickHouseClient>(
	...params: [
		string,
	] | [
		(({
			connection: string | NodeClickHouseClientConfigOptions;
		} | {
			client: TClient;
		})),
	]
) {
	const dialect = new ClickHouseDialect();

	if (typeof params[0] === 'string') {
		const connectionString = params[0]!;
		const pool = createClient({
			url: connectionString,
		});

		return createSqlTemplate(pool, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as {
			connection?: NodeClickHouseClientConfigOptions | string;
			client?: TClient;
		};

		if (client) {
			return createSqlTemplate(client, dialect);
		}

		const client_ = typeof connection === 'string'
			? createClient({
				url: connection,
			})
			: createClient(connection!);

		return createSqlTemplate(client_, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
