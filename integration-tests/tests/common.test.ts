import { describe, expect, test } from 'vitest';
import type { SQL } from 'waddler';
import { PgDialect, SQLDefault, SQLIdentifier, SQLRaw, SQLValues, SQLWrapper } from 'waddler';
import type { ClickHouseSQL } from 'waddler/clickhouse';
import type { SQL as DuckdbSQL } from 'waddler/duckdb';
import type { SqliteSQL } from './sqlite/sqlite-core';

declare module 'vitest' {
	export interface TestContext {
		sql: SQL | DuckdbSQL | SqliteSQL | ClickHouseSQL;
	}
}

const templateFunction = (strings: TemplateStringsArray, ...params: any[]) => {
	return { strings, params };
};
const dialect = new PgDialect();

test('SQLWrapper with template params(SQLIdentifier, SQLValues) test', () => {
	const sql = new SQLWrapper();
	const templateParams = templateFunction`insert into ${new SQLIdentifier('users')} values ${new SQLValues([[
		1,
		new SQLDefault(),
	]])};`;
	sql.with({ templateParams }).prepareQuery(dialect);
	const { query, params } = sql.getQuery(dialect);
	expect(query).toBe('insert into "users" values ($1, default);');
	expect(params).toEqual([1]);
});

test('SQLWrapper with template params(SQLRaw) test', () => {
	const sql = new SQLWrapper();

	const defaultValue = 3;
	const asColumn: string = 'case_column';
	const asClause = asColumn === '' ? new SQLRaw('') : new SQLRaw(` as ${asColumn}`);

	const templateParams = templateFunction`select ${new SQLRaw(
		`case when "default" = ${defaultValue} then 'column=default' else 'column!=default' end`,
	)}${asClause} from all_data_types;`;

	sql.with({ templateParams }).prepareQuery(dialect);
	const { query, params } = sql.getQuery(dialect);
	expect(query).toEqual(
		`select case when "default" = 3 then 'column=default' else 'column!=default' end as case_column from all_data_types;`,
	);
	expect(params.length).toEqual(0);
});

test('SQLWrapper with template params(SQLIdentifier, SQLDefault along with usual params) test', () => {
	const sql = new SQLWrapper();
	const date = new Date('2024-10-31T14:25:29.425Z');
	const templateParams = templateFunction`insert into ${new SQLIdentifier(
		'users',
	)} values (${new SQLDefault()}, ${1}, ${'2'}, ${BigInt(1)}, ${date}, ${true});`;
	sql.with({ templateParams }).prepareQuery(dialect);
	const { query, params } = sql.getQuery(dialect);
	expect(query).toBe('insert into "users" values (default, $1, $2, $3, $4, $5);');
	expect(params).toEqual([1, '2', BigInt(1), date, true]);
});

test('SQLWrapper with raw params test', () => {
	const sql = new SQLWrapper();
	const date = new Date('2024-10-31T14:25:29.425Z');
	const rawParams = {
		query: 'insert into users values (default, $1, $2, $3, $4, $5);',
		params: [1, '2', BigInt(1), date, true],
	};
	sql.with({ rawParams });
	const { query, params } = sql.getQuery(dialect);
	expect(query).toBe('insert into users values (default, $1, $2, $3, $4, $5);');
	expect(params).toEqual([1, '2', BigInt(1), date, true]);
});

export const commonTests = (dialect?: string) => {
	describe('common_tests', () => {
		// toSQL
		test('base test', (ctx) => {
			const res = ctx.sql`select 1;`.toSQL();

			expect(res).toStrictEqual({ query: `select 1;`, params: dialect === 'clickhouse' ? {} : [] });
		});

		// toSQL errors
		test('base test with undefined param. error', (ctx) => {
			// @ts-ignore
			expect(() => ctx.sql`select ${undefined};`.toSQL())
				.toThrowError("you can't specify undefined as parameter");
		});

		test('base test with symbol param. error', (ctx) => {
			// @ts-ignore
			expect(() => ctx.sql`select ${Symbol('fooo')};`.toSQL())
				.toThrowError("you can't specify symbol as parameter");
		});

		test('base test with function param. error', (ctx) => {
			// @ts-ignore
			expect(() => ctx.sql`select ${() => {}};`.toSQL())
				.toThrowError("you can't specify function as parameter");
		});

		// sql.raw ----------------------------------------------------------------------------------
		test('sql.raw test. number | boolean | bigint | string as parameter.', (ctx) => {
			let res = ctx.sql`select ${ctx.sql.raw(1)};`.toSQL();
			expect(res).toStrictEqual({ query: 'select 1;', params: dialect === 'clickhouse' ? {} : [] });

			res = ctx.sql`select ${ctx.sql.raw(true)};`.toSQL();
			expect(res).toStrictEqual({ query: 'select true;', params: dialect === 'clickhouse' ? {} : [] });

			res = ctx.sql`select ${ctx.sql.raw(BigInt(10))};`.toSQL();
			expect(res).toStrictEqual({ query: 'select 10;', params: dialect === 'clickhouse' ? {} : [] });

			res = ctx.sql`select ${ctx.sql.raw('* from users')};`.toSQL();
			expect(res).toStrictEqual({ query: 'select * from users;', params: dialect === 'clickhouse' ? {} : [] });
		});

		// sql.raw errors
		test('sql.raw test. array | object | null | undefined | symbol | function as parameter. error.', (ctx) => {
			let paramList = [[], {}, null];
			for (const param of paramList) {
				expect(
					// @ts-ignore
					() => ctx.sql`select ${ctx.sql.raw(param)};`.toSQL(),
				).toThrowError(`you can't specify array, object or null as parameter for sql.raw.`);
			}

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.raw(undefined)};`.toSQL(),
			).toThrowError(`you can't specify undefined as parameter for sql.raw, maybe you mean using sql.default?`);

			paramList = [Symbol('fooo'), () => {}];
			for (const param of paramList) {
				expect(
					// @ts-ignore
					() => ctx.sql`select ${ctx.sql.raw(param)};`.toSQL(),
				).toThrowError(`you can't specify ${typeof param} as parameter for sql.raw.`);
			}
		});
	});
};
