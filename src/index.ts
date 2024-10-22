import type duckdb from 'duckdb';
import type { RecyclingPool } from './recycling-pool.ts';
import { createFactory, createRecyclingPool } from './recycling-pool.ts';
import type { Identifier, Raw, SQLParamType, Values } from './sql-template.ts';
import { SQLDefault, SQLIndetifier, SQLRaw, SQLTemplate, SQLValues } from './sql-template.ts';

interface SQL {
	<T = duckdb.RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLTemplate<T>;
	identifier(value: Identifier): SQLIndetifier;
	values(value: Values): SQLValues;
	raw(value: Raw): SQLRaw;
	default: SQLDefault;
}

const createSqlTemplate = (pool: RecyclingPool<duckdb.Database>): SQL => {
	// [strings, params]: Parameters<SQL>
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLTemplate<T> => {
		return new SQLTemplate<T>(strings, params, pool);
	};

	Object.assign(fn, {
		identifier: (value: Identifier) => {
			return new SQLIndetifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

export function waddler(
	{ dbUrl, min = 0, max = 1, accessMode = 'read_write' }: {
		dbUrl: string;
		min?: number;
		max?: number;
		accessMode?: 'read_only' | 'read_write';
	},
) {
	const factory = createFactory({ dbUrl, accessMode });
	const opts = {
		max, // maximum size of the pool
		min, // minimum size of the pool
	};

	const pool = createRecyclingPool<duckdb.Database>(factory, opts);

	return createSqlTemplate(pool);
}