import { describe, expect, test } from 'vitest';
import type { SQL } from 'waddler';
import { vitestExpectSoftDate } from '../utils.ts';

export const createAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe(`
			    CREATE TABLE \`all_data_types\` (
				\`integer\` int,
				\`tinyint\` tinyint,
				\`smallint\` smallint,
				\`mediumint\` mediumint,
				\`bigint\` bigint,
				\`real\` real,
				\`decimal\` decimal(4,2),
				\`double\` double,
				\`float\` float,
				\`serial\` serial AUTO_INCREMENT,
				\`binary\` binary(6),
				\`varbinary\` varbinary(6),
				\`char\` char(255),
				\`varchar\` varchar(256),
				\`text\` text,
				\`boolean\` boolean,
				\`date\` date,
				\`datetime\` datetime,
				\`time\` time,
				\`year\` year,
				\`timestamp\` timestamp,
				\`json\` json,
				\`popularity\` enum('unknown','known','popular'),
                \`default\` int default 3
			);
		`);
};

export const dropAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_data_types;');
};

export const defaultValue = 3;

export const createUsersTable = async (sql: SQL) => {
	await sql.unsafe(`create table users(
    id    int,
    name  text,
    age   int,
    email text
	);`);
};

export const dropUsersTable = async (sql: SQL) => {
	await sql.unsafe(`drop table if exists users;`);
};

export const commonMysqlTests = () => {
	describe('common_mysql_tests', () => {
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

			expect(res).toStrictEqual({ query: `select \`name\` from users;`, params: [] });
		});

		test('sql.identifier test. string[] parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier(['name', 'email', 'phone'])} from users;`.toSQL();

			expect(res).toStrictEqual({ query: `select \`name\`, \`email\`, \`phone\` from users;`, params: [] });
		});

		test('sql.identifier test. object parameter', (ctx) => {
			const res = ctx.sql`select * from ${ctx.sql.identifier({ schema: 'public', table: 'users' })};`.toSQL();

			expect(res).toStrictEqual({ query: `select * from \`public\`.\`users\`;`, params: [] });
		});

		test('sql.identifier test. object[] parameter', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier([
					{ schema: 'public', table: 'users', column: 'name' },
					{ schema: 'public', table: 'users', column: 'email' },
				])
			} from users;`.toSQL();

			expect(res).toStrictEqual({
				query: `select \`public\`.\`users\`.\`name\`, \`public\`.\`users\`.\`email\` from users;`,
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
				query:
					`select \`public\`.\`users\`.\`name\` as \`user_name\`, \`public\`.\`users\`.\`email\` as \`user_email\` from users;`,
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
				() =>
					ctx.sql`select ${ctx.sql.identifier({ schema: undefined })}, \`email\`, \`phone\` from \`users\`;`.toSQL(),
			).toThrowError(`you can't specify undefined parameters. maybe you want to omit it?`);
		});

		test("sql.identifier error test. 'no parameters' error with object parameter", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier({})}, \`email\`, \`phone\` from \`users\`;`.toSQL(),
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
						})}, \`email\`, \`phone\` from \`users\`;`.toSQL(),
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
						})}, \`email\`, \`phone\` from \`users\`;`.toSQL(),
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
						})}, \`email\`, \`phone\` from \`users\`;`.toSQL(),
			).toThrowError(`object properties 'table', 'column', 'as' should be of string type or omitted.`);
		});
	});
};

export const commonMysqlAllTypesTests = (driver: 'mysql2' | 'planetscale-serverless' | 'tidb-serverless') => {
	describe('common_mysql_all_types_tests', () => {
		test<{ sql: SQL }>('all types in sql.unsafe test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

			const values = [
				2147483647,
				127,
				32767,
				8388607,
				BigInt('9007199254740992') + BigInt(1),
				1.23,
				10.23,
				100.23,
				101.23,
				1,
				Buffer.from('qwerty'),
				Buffer.from('qwerty'),
				'qwerty',
				'qwerty',
				'qwerty',
				true,
				'2024-10-31', // date
				new Date('2024-10-31T14:25:29.425'), // datetime
				'14:25:29', // time
				2024, // year
				new Date('2024-10-31T14:25:29.425'), // timestamp
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				`known`,
				// ctx.sql.default,
			];

			await ctx.sql.unsafe(
				`insert into all_data_types values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, default);`,
				values,
				{ rowMode: 'object' },
			);

			const res = await ctx.sql.unsafe(`select * from all_data_types;`);

			let expectedRes: Record<string, any>;
			if (driver === 'planetscale-serverless' || driver === 'tidb-serverless') {
				expectedRes = {
					integer: 2147483647,
					tinyint: 127,
					smallint: 32767,
					mediumint: 8388607,
					bigint: '9007199254740993',
					real: 1.23,
					decimal: '10.23',
					double: 100.23,
					float: 101.23,
					serial: '1',
					binary: new Uint8Array(Buffer.from('qwerty')),
					varbinary: new Uint8Array(Buffer.from('qwerty')),
					char: 'qwerty',
					varchar: 'qwerty',
					text: 'qwerty',
					boolean: 1,
					date: '2024-10-31', // date: new Date('2024-10-30T22:00:00.000Z'), // '2024-10-31',
					datetime: '2024-10-31 12:25:29', // new Date('2024-10-31T14:25:29'),
					time: '14:25:29',
					year: 2024,
					timestamp: '2024-10-31 12:25:29', // new Date('2024-10-31T14:25:29'),
					json: {
						name: 'alex',
						age: 26,
						bookIds: [1, 2, 3],
						vacationRate: 2.5,
						aliases: ['sasha', 'sanya'],
						isMarried: true,
					},
					popularity: `known`,
					default: defaultValue,
				};
			} else if (driver === 'mysql2') {
				expectedRes = {
					integer: 2147483647,
					tinyint: 127,
					smallint: 32767,
					mediumint: 8388607,

					// TODO: revise: should return BigInt('9007199254740992') + BigInt(1) not 9007199254740992.
					// It seems to me that mysql2 casts or fetch bigint from db as node-js number therefore type overflows at 9007199254740992.
					bigint: 9007199254740992,
					real: 1.23,
					decimal: '10.23',
					double: 100.23,
					float: 101.23,
					serial: 1,
					binary: Buffer.from('qwerty'),
					varbinary: Buffer.from('qwerty'),
					char: 'qwerty',
					varchar: 'qwerty',
					text: 'qwerty',
					boolean: 1,
					date: new Date('2024-10-31T00:00:00.000'), // '2024-10-31',
					datetime: new Date('2024-10-31T14:25:29'),
					time: '14:25:29',
					year: 2024,
					timestamp: new Date('2024-10-31T14:25:29'),
					json: {
						name: 'alex',
						age: 26,
						bookIds: [1, 2, 3],
						vacationRate: 2.5,
						aliases: ['sasha', 'sanya'],
						isMarried: true,
					},
					popularity: `known`,
					default: defaultValue,
				};
			} else {
				throw new Error('driver is not specified in sql.unsafe test.');
			}

			expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
			let predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
				vitestExpectSoftDate(colValue, expectedRes[colName])
			);
			expect(predicate).toBe(true);
			// expect(res[0]).toStrictEqual(expectedRes);

			// same as select query as above but with rowMode: "array"
			const arrayResult = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

			expect(arrayResult[0]!.length).toBe(Object.keys(expectedRes).length);
			predicate = Object.values(expectedRes).every((expectedValue, idx) =>
				vitestExpectSoftDate(arrayResult[0]![idx], expectedValue)
			);
			expect(predicate).toBe(true);
			// expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));

			await dropAllDataTypesTable(ctx.sql);
		});

		test<{ sql: SQL }>('all types in sql.values test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

			const allDataTypesValues = [
				2147483647,
				127,
				32767,
				8388607,
				BigInt('9007199254740992') + BigInt(1),
				1.23,
				10.23,
				100.23,
				101.23,
				1,
				Buffer.from('qwerty'),
				Buffer.from('qwerty'),
				'qwerty',
				'qwerty',
				'qwerty',
				true,
				'2024-10-31', // '2024-10-31',
				new Date('2024-10-31T14:25:29'),
				'14:25:29',
				2024,
				new Date('2024-10-31T14:25:29.425'),
				{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				`known`,
				ctx.sql.default,
			];

			let expectedRes: any[];
			if (driver === 'planetscale-serverless' || driver === 'tidb-serverless') {
				expectedRes = [
					2147483647,
					127,
					32767,
					8388607,
					'9007199254740993',
					1.23,
					'10.23',
					100.23,
					101.23,
					'1',
					new Uint8Array(Buffer.from('qwerty')),
					new Uint8Array(Buffer.from('qwerty')),
					'qwerty',
					'qwerty',
					'qwerty',
					1,
					'2024-10-31', // new Date('2024-10-31T22:00:00.000Z'), // '2024-10-31',
					'2024-10-31 12:25:29', // new Date('2024-10-31T14:25:29'),
					'14:25:29',
					2024,
					'2024-10-31 12:25:29', // new Date('2024-10-31T14:25:29Z'),
					{
						name: 'alex',
						age: 26,
						bookIds: [1, 2, 3],
						vacationRate: 2.5,
						aliases: ['sasha', 'sanya'],
						isMarried: true,
					},
					`known`,
					defaultValue,
				];
			} else if (driver === 'mysql2') {
				expectedRes = [
					2147483647,
					127,
					32767,
					8388607,

					// TODO: revise: should return BigInt('9007199254740992') + BigInt(1) not 9007199254740992.
					// It seems to me that mysql2 casts or fetch bigint from db as node-js number therefore type overflows at 9007199254740992.
					9007199254740992,
					1.23,
					'10.23',
					100.23,
					101.23,
					1,
					Buffer.from('qwerty'),
					Buffer.from('qwerty'),
					'qwerty',
					'qwerty',
					'qwerty',
					1,
					new Date('2024-10-31T00:00:00.000'), // '2024-10-31',
					new Date('2024-10-31T14:25:29'),
					'14:25:29',
					2024,
					new Date('2024-10-31T14:25:29'),
					{
						name: 'alex',
						age: 26,
						bookIds: [1, 2, 3],
						vacationRate: 2.5,
						aliases: ['sasha', 'sanya'],
						isMarried: true,
					},
					`known`,
					defaultValue,
				];
			} else {
				throw new Error('driver is not specified in sql.unsafe test.');
			}

			await ctx.sql`insert into ${ctx.sql.identifier('all_data_types')} values ${
				ctx.sql.values([allDataTypesValues])
			};`;

			const res = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

			expect(res[0]!.length).toBe(expectedRes.length);
			const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
				vitestExpectSoftDate(res[0]![idx], expectedValue)
			);
			expect(predicate).toBe(true);
			// expect(res[0]).toStrictEqual(expectedRes);
		});
	});
};
