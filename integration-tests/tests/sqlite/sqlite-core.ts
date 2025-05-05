import { describe, expect, test } from 'vitest';
import type { BetterSqlite3SQL } from 'waddler/better-sqlite3';
import type { BunSqliteSQL } from 'waddler/bun-sqlite';
import type { D1SQL } from 'waddler/d1';
import type { DurableSqliteSQL } from 'waddler/durable-sqlite';
import type { LibsqlSQL } from 'waddler/libsql';
import type { OpSqliteSQL } from 'waddler/op-sqlite';

export type SqliteSQL = BetterSqlite3SQL | BunSqliteSQL | D1SQL | LibsqlSQL | DurableSqliteSQL | OpSqliteSQL;

export const createAllDataTypesTable = async (sql: SqliteSQL) => {
	await sql`
		    CREATE TABLE "all_data_types" (
			"integer_number" integer,
			"integer_bigint" integer,
			"real" real,
			"text" text,
			"text_json" text,
			"blob_bigint" blob,
			"blob_buffer" blob,
			"blob_json" blob,
			"numeric" numeric
		);
	`.run();
};

export const dropAllDataTypesTable = async (sql: SqliteSQL) => {
	await sql`drop table if exists "all_data_types";`.run();
};

export const commonSqliteTests = () => {
	describe('common_sqlite_tests', () => {
		// toSQL
		test('base test with number param', (ctx) => {
			const res = ctx.sql`select ${1};`.toSQL();

			expect(res).toStrictEqual({ query: `select ?;`, params: [1] });
		});

		test('base test with bigint param', (ctx) => {
			const res = ctx.sql`select ${BigInt(10)};`.toSQL();

			expect(res).toStrictEqual({ query: `select ?;`, params: [10n] });
		});

		test('base test with string param', (ctx) => {
			const res = ctx.sql`select ${'hello world.'};`.toSQL();

			expect(res).toStrictEqual({ query: `select ?;`, params: ['hello world.'] });
		});

		test('base test with boolean param', (ctx) => {
			const res = ctx.sql`select ${true};`.toSQL();

			expect(res).toStrictEqual({ query: `select ?;`, params: [true] });
		});

		test('base test with Date param', (ctx) => {
			const res = ctx.sql`select ${new Date('10.04.2025')};`.toSQL();

			expect(res).toStrictEqual({ query: `select ?;`, params: [new Date('10.04.2025')] });
		});

		test('base test with null param', (ctx) => {
			const res = ctx.sql`select ${null};`.toSQL();

			expect(res).toStrictEqual({ query: `select ?;`, params: [null] });
		});

		// sql.append
		test('sql.append test.', (ctx) => {
			const query = ctx.sql<undefined>`select * from users where id = ${1}`;

			query.append(ctx.sql` or id = ${3}`);
			query.append(ctx.sql` or id = ${4};`);

			const res = query.toSQL();
			expect(res).toStrictEqual({
				query: 'select * from users where id = ? or id = ? or id = ?;',
				params: [1, 3, 4],
			});
		});

		// identifier ----------------------------------------------------------------------------------
		test('sql.identifier test. string parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier('name')} from users;`.toSQL();

			expect(res).toStrictEqual({ query: `select "name" from users;`, params: [] });
		});

		test('sql.identifier test. string[] parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier(['name', 'email', 'phone'])} from users;`.toSQL();

			expect(res).toStrictEqual({ query: `select "name", "email", "phone" from users;`, params: [] });
		});

		test('sql.identifier test. object parameter', (ctx) => {
			const res = ctx.sql`select * from ${ctx.sql.identifier({ schema: 'public', table: 'users' })};`.toSQL();

			expect(res).toStrictEqual({ query: `select * from "public"."users";`, params: [] });
		});

		test('sql.identifier test. object[] parameter', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier([
					{ schema: 'public', table: 'users', column: 'name' },
					{ schema: 'public', table: 'users', column: 'email' },
				])
			} from users;`.toSQL();

			expect(res).toStrictEqual({
				query: `select "public"."users"."name", "public"."users"."email" from users;`,
				params: [],
			});
		});

		test('sql.identifier test. object[] parameter', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier([
					{ schema: 'public', table: 'users', column: 'name', as: 'user_name' },
					{ schema: 'public', table: 'users', column: 'email', as: 'user_email' },
				])
			} from users;`.toSQL();

			expect(res).toStrictEqual({
				query: `select "public"."users"."name" as "user_name", "public"."users"."email" as "user_email" from users;`,
				params: [],
			});
		});

		// errors
		test('sql.identifier error test. undefined | number | bigint | boolean | symbol | function | null as parameter. error', (ctx) => {
			const paramList = [undefined, 1, BigInt(10), true, Symbol('fooo'), () => {}];
			for (const param of paramList) {
				expect(
					// @ts-ignore
					() => ctx.sql`select ${ctx.sql.identifier(param)} from users;`.toSQL(),
				).toThrowError(`you can't specify ${typeof param} as parameter for sql.identifier.`);
			}

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.identifier(null)} from users;`.toSQL(),
			).toThrowError(`you can't specify null as parameter for sql.identifier.`);
		});

		test('sql.identifier error test. array of undefined | number | bigint | boolean | symbol | function | null | array as parameter. error', (ctx) => {
			const paramList = [
				['name', undefined],
				['name', 1],
				['name', BigInt(10)],
				['name', true],
				['name', Symbol('foo')],
				['name', () => {}],
			];
			for (const param of paramList) {
				expect(
					// @ts-ignore
					() => ctx.sql`select ${ctx.sql.identifier(param)} from users;`.toSQL(),
				).toThrowError(
					`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
				);
			}

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.identifier([null])} from users;`.toSQL(),
			).toThrowError(
				`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
			);

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.identifier(['name', []])} from users;`.toSQL(),
			).toThrowError(`you can't specify array of arrays as parameter for sql.identifier.`);
		});

		test("sql.identifier error test. 'empty array' error", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier([])} from users;`.toSQL(),
			).toThrowError(`you can't specify empty array as parameter for sql.identifier.`);
		});

		test("sql.identifier error test. 'undefined in parameters' error with object parameter", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier({ schema: undefined })}, "email", "phone" from "users";`.toSQL(),
			).toThrowError(`you can't specify undefined parameters. maybe you want to omit it?`);
		});

		test("sql.identifier error test. 'no parameters' error with object parameter", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier({})}, "email", "phone" from "users";`.toSQL(),
			).toThrowError(`you need to specify at least one parameter.`);
		});

		test("sql.identifier error test. 'only as' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${ctx.sql.identifier({ as: 'user_name' })}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(
				`you can't specify only "as" property. you have to specify "column" or "table" property along with "as".`,
			);
		});

		test("sql.identifier error test. wrong types in object's properties 'table', 'column', 'as'. error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							table: 'users',
							column: 'name',
							as: 4,
						})}, "email", "phone" from "users";`.toSQL(),
			).toThrowError(`object properties 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							table: 'users',
							column: 4,
							as: 'user_name',
						})}, "email", "phone" from "users";`.toSQL(),
			).toThrowError(`object properties 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							table: 4,
							column: 'name',
							as: 'user_name',
						})}, "email", "phone" from "users";`.toSQL(),
			).toThrowError(`object properties 'table', 'column', 'as' should be of string type or omitted.`);
		});
	});
};

export const defaultValue = 3;
