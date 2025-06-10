import { describe, expect, test } from 'vitest';
import type { SQL } from 'waddler';

export const defaultValue = 3;

const createMoodEnumType = async (sql: SQL) => {
	await sql.unsafe(
		`CREATE TYPE "public"."mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');`,
	).catch(() => {});
};

const dropMoodEnumType = async (sql: SQL) => {
	await sql.unsafe(
		`DROP TYPE "public"."mood_enum";`,
	).catch(() => {});
};
export const createAllDataTypesTable = async (sql: SQL) => {
	await createMoodEnumType(sql);

	await sql.unsafe(`create table all_data_types (
    "integer" integer,
	"smallint" smallint,
	"bigint" bigint,
	"serial" serial,
	"smallserial" smallserial,
	"bigserial" bigserial,
	"boolean" boolean,
	"text" text,
	"varchar" varchar(256),
	"char" char(6),
	"numeric" numeric,
	"real" real,
	"double_precision" double precision,
	"json" json,
	"jsonb" jsonb,
	"time" time,
	"timestamp_date" timestamp,
	"date" date,
	"interval" interval,
	"point" "point",
	"line" "line",
	"mood_enum" "public"."mood_enum",
	"uuid" "uuid",
	"bytea" "bytea",
	"default" int default ${defaultValue}
    );`);
};

export const dropAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_data_types;');
	await dropMoodEnumType(sql);
};

export const createAllArrayDataTypesTable = async (sql: SQL) => {
	await createMoodEnumType(sql);

	await sql.unsafe(`CREATE TABLE IF NOT EXISTS "public"."all_array_data_types" (
   "integer_array" integer[],
   "smallint_array" smallint[],
   "bigint_array" bigint[],
   "boolean_array" boolean[],
   "text_array" text[],
   "varchar_array" varchar(256)[],
   "char_array" char(6)[],
   "numeric_array" numeric[],
   "real_array" real[],
   "double_precision_array" double precision[],
   "json_array" json[],
   "jsonb_array" jsonb[],
   "time_array" time[],
   "timestamp_date_array" timestamptz[],
   "date_array" date[],
   "interval_array" interval[],
   "point_array" point[],
   "line_array" line[],
   "mood_enum_array" "public"."mood_enum"[],
   uuid_array "uuid"[]
);`);
};

export const dropAllArrayDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_array_data_types;');
	await dropMoodEnumType(sql);
};

export const createAllNdarrayDataTypesTable = async (sql: SQL) => {
	await createMoodEnumType(sql);

	await sql.unsafe(`CREATE TABLE IF NOT EXISTS "public"."all_nd_array_data_types" (
   "integer_array_2d" integer[][],
   "json_array_2d" json[][],
   "jsonb_array_2d" jsonb[][],
   "time_array_2d" time[][],
   "timestamp_date_array_2d" timestamptz[][],
   "date_array_2d" date[][],
   "interval_array_2d" interval[][],
   "point_array_2d" point[][],
   "line_array_2d" line[][],
   "mood_enum_array_2d" "public"."mood_enum"[][],
   uuid_array_2d "uuid"[][]
);`);
};

export const dropAllNdarrayDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_nd_array_data_types;');
	await dropMoodEnumType(sql);
};

export const commonPgTests = () => {
	describe('common_pg_tests', () => {
		// default ------------------------------------------------------------------------------
		test<{ sql: SQL }>('sql.default test using with sql.values.', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values ${ctx.sql.values([[ctx.sql.default]])};`.toSQL();
			expect(res).toStrictEqual({ query: 'insert into users (id, name) values (default);', params: [] });
		});

		test<{ sql: SQL }>('sql.default test using with sql`${}` as parameter.', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values (${ctx.sql.default}, 'name1');`.toSQL();
			expect(res).toStrictEqual({ query: "insert into users (id, name) values (default, 'name1');", params: [] });
		});

		// toSQL
		test('base test with number param', (ctx) => {
			const res = ctx.sql`select ${1};`.toSQL();

			expect(res).toStrictEqual({ query: `select $1;`, params: [1] });
		});

		test('base test with bigint param', (ctx) => {
			const res = ctx.sql`select ${BigInt(10)};`.toSQL();

			expect(res).toStrictEqual({ query: `select $1;`, params: [10n] });
		});

		test('base test with string param', (ctx) => {
			const res = ctx.sql`select ${'hello world.'};`.toSQL();

			expect(res).toStrictEqual({ query: `select $1;`, params: ['hello world.'] });
		});

		test('base test with boolean param', (ctx) => {
			const res = ctx.sql`select ${true};`.toSQL();

			expect(res).toStrictEqual({ query: `select $1;`, params: [true] });
		});

		test('base test with Date param', (ctx) => {
			const res = ctx.sql`select ${new Date('10.04.2025')};`.toSQL();

			expect(res).toStrictEqual({ query: `select $1;`, params: [new Date('10.04.2025')] });
		});

		test('base test with null param', (ctx) => {
			const res = ctx.sql`select ${null};`.toSQL();

			expect(res).toStrictEqual({ query: `select $1;`, params: [null] });
		});

		// sql.append
		test('sql.append test.', (ctx) => {
			const query = ctx.sql<undefined>`select * from users where id = ${1}`;

			query.append(ctx.sql` or id = ${3}`);
			query.append(ctx.sql` or id = ${4};`);

			const res = query.toSQL();
			expect(res).toStrictEqual({
				query: 'select * from users where id = $1 or id = $2 or id = $3;',
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

export const nodePgTests = () => {
	describe('node_pg_tests', () => {
		// UNSAFE-------------------------------------------------------------------
		test<{ sql: SQL }>('all types in sql.unsafe test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

			const date = new Date('2024-10-31T14:25:29.425');
			const values = [
				1,
				10,
				BigInt('9007199254740992') + BigInt(1),
				1,
				10,
				BigInt('9007199254740992') + BigInt(1),
				true,
				'qwerty',
				'qwerty',
				'qwerty',
				'20.4',
				20.4,
				20.4,
				{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
				{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
				'14:25:29.425',
				date,
				'2024-10-31',
				'1 day',
				'(1,2)',
				'{1,2,3}',
				`no,'"\`rm`,
				'550e8400-e29b-41d4-a716-446655440000',
				Buffer.from('qwerty'),
				// ctx.sql.default,
			];

			await ctx.sql.unsafe(
				`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, default);`,
				values,
				{ rowMode: 'object' },
			);

			const res = await ctx.sql.unsafe(`select * from all_data_types;`);

			const dateWithoutTime = new Date(date);
			dateWithoutTime.setUTCHours(0, 0, 0, 0);
			const expectedRes = {
				integer: 1,
				smallint: 10,
				bigint: String(BigInt('9007199254740992') + BigInt(1)),
				serial: 1,
				smallserial: 10,
				bigserial: String(BigInt('9007199254740992') + BigInt(1)),
				boolean: true,
				text: 'qwerty',
				varchar: 'qwerty',
				char: 'qwerty',
				numeric: '20.4',
				real: 20.4,
				double_precision: 20.4,
				json: {
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				jsonb: {
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				time: '14:25:29.425',
				timestamp_date: date,
				date: new Date('2024-10-31T00:00:00.000'),
				interval: '1 day',
				point: { x: 1, y: 2 }, // [1, 2]
				line: '{1,2,3}', // [1, 2, 3]
				mood_enum: `no,'"\`rm`,
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				bytea: Buffer.from('qwerty'),
				default: defaultValue,
			};

			expect(res[0]).toStrictEqual(expectedRes);

			// same as select query as above but with rowMode: "array"
			const arrayResult = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
			expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));

			await dropAllDataTypesTable(ctx.sql);
		});

		// sql.values
		// ALL TYPES-------------------------------------------------------------------
		test<{ sql: SQL }>('all types in sql.values test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

			const date = new Date('2024-10-31T14:25:29.425Z');
			const allDataTypesValues = [
				1,
				10,
				BigInt('9007199254740992') + BigInt(1),
				1,
				10,
				BigInt('9007199254740992') + BigInt(1),
				true,
				'qwerty',
				'qwerty',
				'qwerty',
				'20.4',
				20.4,
				20.4,
				{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
				{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
				'14:25:29.425',
				date,
				'2024-10-31',
				'1 day',
				'(1,2)',
				'{1,2,3}',
				`no,'"\`rm`,
				'550e8400-e29b-41d4-a716-446655440000',
				Buffer.from('qwerty'),
				ctx.sql.default,
			];

			const expectedRes = [
				1,
				10,
				String(BigInt('9007199254740992') + BigInt(1)),
				1,
				10,
				String(BigInt('9007199254740992') + BigInt(1)),
				true,
				'qwerty',
				'qwerty',
				'qwerty',
				'20.4',
				20.4,
				20.4,
				{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
				{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
				'14:25:29.425',
				date,
				new Date('2024-10-31T00:00:00.000'),
				'1 day',
				{ x: 1, y: 2 }, // [1, 2],
				'{1,2,3}', // [1, 2, 3],
				`no,'"\`rm`,
				'550e8400-e29b-41d4-a716-446655440000',
				Buffer.from('qwerty'),
				defaultValue,
			];

			await ctx.sql`insert into ${ctx.sql.identifier('all_data_types')} values ${
				ctx.sql.values([allDataTypesValues])
			};`;

			const res = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

			expect(res[0]).toStrictEqual(expectedRes);
			await dropAllDataTypesTable(ctx.sql);
		});

		test<{ sql: SQL }>('all array types in sql.values test', async (ctx) => {
			await createAllArrayDataTypesTable(ctx.sql);

			const date = new Date('2024-10-31T14:25:29.425Z');

			const allArrayDataTypesValues = [
				[1],
				[10],
				[String(BigInt('9007199254740992') + BigInt(1))],
				[true],
				['qwerty'],
				['qwerty'],
				['qwerty'],
				[20.4],
				[20.4],
				[20.4],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				['14:25:29.425'],
				[date],
				['2024-10-31'],
				['1 days'],
				['(1,2)'],
				['{1.1,2,3}', '{4.4,5,6}'],
				['ok', 'happy', `no,'"\`rm`],
				['550e8400-e29b-41d4-a716-446655440000'],
			];

			const expectedRes1 = [
				[1],
				[10],
				[String(BigInt('9007199254740992') + BigInt(1))],
				[true],
				['qwerty'],
				['qwerty'],
				['qwerty'],
				[20.4],
				[20.4],
				[20.4],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				['14:25:29.425'],
				[date],
				[new Date('2024-10-31T00:00:00.000')],
				`{"1 day"}`, // ['1 day'],
				[{ x: 1, y: 2 }], // [[1, 2]],
				'{"{1.1,2,3}","{4.4,5,6}"}', // [[1.1, 2, 3], [4.4, 5, 6]], // ['{1.1,2,3}', '{4.4,5,6}'],
				'{ok,happy,"no,\'\\"`rm"}', // ['ok', 'happy', `no,'"\`rm`],
				['550e8400-e29b-41d4-a716-446655440000'],
			];

			await ctx.sql`insert into ${ctx.sql.identifier('all_array_data_types')} values ${
				ctx.sql.values([allArrayDataTypesValues])
			};`;

			const res = await ctx.sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

			expect(res[0]).toStrictEqual(expectedRes1);

			await dropAllArrayDataTypesTable(ctx.sql);
		});

		test<{ sql: SQL }>('all nd-array types in sql.values test', async (ctx) => {
			await createAllNdarrayDataTypesTable(ctx.sql);

			const date = new Date('2024-10-31T14:25:29.425Z');

			const json = {
				name: 'alex',
				age: 26,
				bookIds: [1, 2, 3],
				vacationRate: 2.5,
				aliases: ['sasha', 'sanya'],
				isMarried: true,
			};
			const allArrayDataTypesValues = [
				[[1, 2], [2, 3]],
				[[json], [json]],
				[[json], [json]],
				[['14:25:29.425'], ['14:25:29.425']],
				[[date], [date]],
				[['2024-10-31'], ['2024-10-31']],
				[['1 days'], ['1 days']],
				[['(1,2)'], ['(1,2)']],
				[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']],
				[['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
				[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
			];

			const expectedRes1 = [
				[[1, 2], [2, 3]],
				[[json], [json]],
				[[json], [json]],
				[['14:25:29.425'], ['14:25:29.425']],
				[[date], [date]],
				[[new Date('2024-10-31T00:00:00.000')], [new Date('2024-10-31T00:00:00.000')]],
				`{{"1 day"},{"1 day"}}`, // [['1 days'], ['1 days']]
				[[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]], // [[[1, 2]], [[1, 2]]],
				'{{"{1.1,2,3}","{4.4,5,6}"},{"{1.1,2,3}","{4.4,5,6}"}}', // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]],
				'{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}', // [['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
				[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
			];

			await ctx.sql`insert into ${ctx.sql.identifier('all_nd_array_data_types')} values ${
				ctx.sql.values([allArrayDataTypesValues])
			};`;

			const res = await ctx.sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

			expect(res[0]).toStrictEqual(expectedRes1);

			await dropAllNdarrayDataTypesTable(ctx.sql);
		});
	});
};
