import { describe, expect, test } from 'vitest';
import type { SQL } from 'waddler';

export const defaultValue = 3;

export const createAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe(`
				CREATE TABLE [all_data_types] (
				[tinyint] tinyint,
				[smallint] smallint,
				[integer] int,
				[bigint] bigint,
				[real] real,
				[decimal] decimal(5,2),
				[numeric] numeric(7,3),
				[float] float(25),
				[binary] binary(9),
				[varbinary] varbinary(10),
				[char] char(9),
				[varchar] varchar(10),
				[text] text,
				[bit] bit,
				[date_string] date,
				[date] date,
				[datetime_string] datetime,
				[datetime] datetime,
				[datetime2_string] datetime2,
				[datetime2] datetime2,
				[datetime_offset_string] datetimeoffset,
				[datetime_offset] datetimeoffset,
				[time] time,
				[default] int default ${defaultValue} 
			);
		`);
};

export const dropAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists [all_data_types];');
	// await dropMoodEnumType(sql);
};

export const createUsersTable = async (sql: SQL) => {
	await sql.unsafe(`create table [users](
    [id]    int,
    [name]  NVARCHAR(MAX),
    [age]   int,
    [email] NVARCHAR(MAX)
	);`);
};

export const dropUsersTable = async (sql: SQL) => {
	await sql.unsafe(`drop table if exists [users];`);
};

export const commonMsSqlTests = () => {
	describe('common_mssql_tests', () => {
		// default ------------------------------------------------------------------------------
		test<{ sql: SQL }>('sql.default test using with sql.values.', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values ${ctx.sql.values([[ctx.sql.default]])};`.toSQL();
			expect(res).toStrictEqual({ sql: 'insert into users (id, name) values (default);', params: [] });
		});

		test<{ sql: SQL }>('sql.default test using with sql`${}` as parameter.', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values (${ctx.sql.default}, 'name1');`.toSQL();
			expect(res).toStrictEqual({ sql: "insert into users (id, name) values (default, 'name1');", params: [] });
		});

		// toSQL
		test('base test with number param', (ctx) => {
			const res = ctx.sql`select ${1};`.toSQL();

			expect(res).toStrictEqual({ sql: `select @p1;`, params: [1] });
		});

		test('base test with bigint param', (ctx) => {
			const res = ctx.sql`select ${BigInt(10)};`.toSQL();

			expect(res).toStrictEqual({ sql: `select @p1;`, params: [10n] });
		});

		test('base test with string param', (ctx) => {
			const res = ctx.sql`select ${'hello world.'};`.toSQL();

			expect(res).toStrictEqual({ sql: `select @p1;`, params: ['hello world.'] });
		});

		test('base test with boolean param', (ctx) => {
			const res = ctx.sql`select ${true};`.toSQL();

			expect(res).toStrictEqual({ sql: `select @p1;`, params: [true] });
		});

		test('base test with Date param', (ctx) => {
			const res = ctx.sql`select ${new Date('10.04.2025')};`.toSQL();

			expect(res).toStrictEqual({ sql: `select @p1;`, params: [new Date('10.04.2025')] });
		});

		test('base test with null param', (ctx) => {
			const res = ctx.sql`select ${null};`.toSQL();

			expect(res).toStrictEqual({ sql: `select @p1;`, params: [null] });
		});

		// sql.append
		test<{ sql: SQL }>('sql.append test.', (ctx) => {
			const query = ctx.sql<undefined>`select * from users where id = ${1}`;

			query.append(ctx.sql` or id = ${3}`);
			query.append(ctx.sql` or id = ${4};`);

			const res = query.toSQL();
			expect(res).toStrictEqual({
				sql: 'select * from users where id = @p1 or id = @p2 or id = @p3;',
				params: [1, 3, 4],
			});
		});

		// identifier ----------------------------------------------------------------------------------
		test('sql.identifier test. string parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier('name')} from users;`.toSQL();

			expect(res).toStrictEqual({ sql: `select [name] from users;`, params: [] });
		});

		test('sql.identifier test. string[] parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier(['name', 'email', 'phone'])} from users;`.toSQL();

			expect(res).toStrictEqual({ sql: `select [name], [email], [phone] from users;`, params: [] });
		});

		test('sql.identifier test. object parameter', (ctx) => {
			const res = ctx.sql`select * from ${ctx.sql.identifier({ schema: 'public', table: 'users' })};`.toSQL();

			expect(res).toStrictEqual({ sql: `select * from [public].[users];`, params: [] });
		});

		test('sql.identifier test. object[] parameter', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier([
					{ schema: 'public', table: 'users', column: 'name' },
					{ schema: 'public', table: 'users', column: 'email' },
				])
			} from users;`.toSQL();

			expect(res).toStrictEqual({
				sql: `select [public].[users].[name], [public].[users].[email] from users;`,
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
				sql: `select [public].[users].[name] as [user_name], [public].[users].[email] as [user_email] from users;`,
				params: [],
			});
		});

		// errors
		test('sql.identifier test. undefined | number | bigint | boolean | symbol | function | null as parameter. error', (ctx) => {
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

		test('sql.identifier test. array of undefined | number | bigint | boolean | symbol | function | null | array as parameter. error', (ctx) => {
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

		test("sql.identifier test. 'empty array' error", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier([])} from users;`.toSQL(),
			).toThrowError(`you can't specify empty array as parameter for sql.identifier.`);
		});

		test("sql.identifier test. 'undefined in parameters' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${ctx.sql.identifier({ schema: undefined })}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`you can't specify undefined parameters. maybe you want to omit it?`);
		});

		test("sql.identifier test. 'no parameters' error with object parameter", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier({})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`you need to specify at least one parameter.`);
		});

		test("sql.identifier test. 'only schema and column' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						ctx.sql.identifier({ schema: 'public', column: 'name' })
					}, "email", "phone" from "public"."users";`
						.toSQL(),
			).toThrowError(`you can't specify only "schema" and "column" properties, you need also specify "table".`);
		});

		test("sql.identifier test. 'only as' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${ctx.sql.identifier({ as: 'user_name' })}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`you can't specify only "as" property.`);
		});

		test("sql.identifier test. 'column or table should be specified with as' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						ctx.sql.identifier({ schema: 'public', as: 'user_name' })
					}, "email", "phone" from "public"."users";`
						.toSQL(),
			).toThrowError(`you have to specify "column" or "table" property along with "as".`);
		});

		test("sql.identifier test. wrong types in object's properties 'schema', 'table', 'column', 'as'. error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 'public',
							table: 'users',
							column: 'name',
							as: 4,
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 'public',
							table: 'users',
							column: 4,
							as: 'user_name',
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 'public',
							table: 4,
							column: 'name',
							as: 'user_name',
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 4,
							table: 'users',
							column: 'name',
							as: 'user_name',
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);
		});
	});
};
