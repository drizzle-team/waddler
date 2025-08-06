import type Docker from 'dockerode';
import type { Sql } from 'postgres';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler';
import { sql as sqlQuery, waddler } from 'waddler/postgres-js';
import { commonTests } from '../../common.test.ts';
import { createPgDockerDB } from '../../utils.ts';
import {
	commonPgTests,
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	createAllNdarrayDataTypesTable,
	createMoodEnumType,
	createUsersTable,
	defaultValue,
	dropAllDataTypesTable,
	dropUsersTable,
} from '../pg-core.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

let pgContainer: Docker.Container;
let pgClient: Sql;
let pgConnectionParams: {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	ssl: boolean;
};

let sql: SQL;
beforeAll(async () => {
	const dockerPayload = await createPgDockerDB();
	const sleep = 1000;
	let timeLeft = 40000;
	let connected = false;
	let lastError;

	pgContainer = dockerPayload.pgContainer;
	do {
		try {
			pgConnectionParams = dockerPayload.connectionParams;
			const testPgClient = postgres(dockerPayload.connectionParams);
			const testSql = waddler({ client: testPgClient });
			await testSql.unsafe(`select 1;`);
			await createMoodEnumType(testSql);

			await testPgClient.end();
			connected = true;
			break;
		} catch (e) {
			lastError = e;
			await new Promise((resolve) => setTimeout(resolve, sleep));
			timeLeft -= sleep;
		}
	} while (timeLeft > 0);
	if (!connected) {
		console.error('Cannot connect to Postgres');
		await pgClient?.end().catch(console.error);
		await pgContainer?.stop().catch(console.error);
		throw lastError;
	}

	pgClient = postgres(dockerPayload.connectionParams);
	sql = waddler({ client: pgClient });
	// await createMoodEnumType(sql);
});

afterAll(async () => {
	await pgClient?.end().catch(console.error);
	await pgContainer?.stop().catch(console.error);
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

test('connection test', async () => {
	const pool = postgres({ ...pgConnectionParams });
	const sql1 = waddler({ client: pool });
	await sql1`select 1;`;

	await pool.end();

	const sql2 = waddler({ connection: pgConnectionParams });
	await sql2`select 2;`;

	const url =
		`postgres://${pgConnectionParams.user}:${pgConnectionParams.password}@${pgConnectionParams.host}:${pgConnectionParams.port}/${pgConnectionParams.database}`;
	const sql21 = waddler({ connection: url });
	await sql21`select 21;`;

	const sql22 = waddler(url);
	await sql22`select 22;`;

	const sql23 = waddler({ connection: { url } });
	await sql23`select 23;`;
});

test('logger test', async () => {
	const loggerQuery = 'select $1;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	const logger = {
		logQuery: (query: string, params: unknown[]) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
		},
	};

	let loggerSql: SQL;
	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});

	// case 0
	const client = postgres({ ...pgConnectionParams });
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(loggerText);

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	const url =
		`postgres://${pgConnectionParams.user}:${pgConnectionParams.password}@${pgConnectionParams.host}:${pgConnectionParams.port}/${pgConnectionParams.database}`;
	loggerSql = waddler(url, { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(url, { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(loggerText);

	loggerSql = waddler(url, { logger: false });
	await loggerSql`select ${1};`;
});

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

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
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		'14:25:29.425',
		new Date('2024-10-31T14:25:29.425Z'),
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		Buffer.from('qwerty'),
		// sql.default,
	];

	await sql.unsafe(
		`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, default);`,
		values,
		{ rowMode: 'object' },
	);

	const res = await sql.unsafe(`select * from all_data_types;`);

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
		timestamp_date: new Date('2024-10-31T14:25:29.425'),
		date: new Date('2024-10-31T00:00:00.000Z'),
		interval: '1 day',
		point: '(1,2)', // [1, 2]
		line: '{1,2,3}', // [1, 2, 3]
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		bytea: Buffer.from('qwerty'),
		default: defaultValue,
	};

	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
	expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values, sql.raw in select test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

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
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		'14:25:29.425',
		new Date('2024-10-31T14:25:29.425Z'),
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		Buffer.from('qwerty'),
		sql.default,
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
		new Date('2024-10-31T14:25:29.425'),
		new Date('2024-10-31T00:00:00.000Z'),
		'1 day',
		'(1,2)', // [1, 2],
		'{1,2,3}', // [1, 2, 3],
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		Buffer.from('qwerty'),
		defaultValue,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes);

	// sql.raw case
	const asColumn: string = 'case_column';
	const asClause = asColumn === '' ? sql.raw('') : sql.raw(` as ${asColumn}`);

	const res1Query = sql`select ${
		sql.raw(`case when "default" = ${defaultValue} then 'column=default' else 'column!=default' end`)
	}${asClause} from all_data_types;`;

	const { query: res1Sql, params: res1Params } = res1Query.toSQL();
	expect(res1Sql).toEqual(
		`select case when "default" = 3 then 'column=default' else 'column!=default' end as case_column from all_data_types;`,
	);
	expect(res1Params.length).toEqual(0);

	const res1 = await res1Query;
	expect(res1[0]!['case_column']).toEqual('column=default');
});

// enum array error:
// Because each time I used the dropAllDataTypesTable function, I dropped the mood_enum type and then recreated it in createAllDataTypesTable,
// the mood_enum type’s OID changed.
// Also, it seems that postgres-js fetches types only on the first database connection (i.e., at the first query).
// Because that query runs before the enum exists, postgres-js doesn’t register a parser for `mood_enum[]`, resulting in unparsed string output.
// Now, I create `mood_enum` before all tests using one connection, close that connection, and then open a new connection for the tests.
//

test('all array types in sql.values test', async () => {
	await createAllArrayDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425Z');

	const allArrayDataTypesValues = [
		[1],
		[10],
		[BigInt('9007199254740992') + BigInt(1)],
		[true],
		['qwerty'],
		['qwerty'],
		['qwerty'],
		[20.4],
		[20.4],
		[20.4],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		['14:25:29.425'],
		[date],
		['2024-10-31'],
		['1 days'],
		['(1,2)'],
		['{1.1,2,3}', '{4.4,5,6}'],
		['ok', 'happy', `no,'"\`rm`],
		['550e8400-e29b-41d4-a716-446655440000'],
	];

	const expectedRes = [
		[1],
		[10],
		[String(BigInt('9007199254740992') + BigInt(1))],
		[true],
		['qwerty'],
		['qwerty'],
		['qwerty'],
		['20.4'],
		[20.4],
		[20.4],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		['14:25:29.425'],
		[date],
		[new Date('2024-10-31T00:00:00.000Z')],
		['1 day'], // `{"1 day"}`,
		['(1,2)'], // [[1, 2]], [{ x: 1, y: 2 }],
		['{1.1,2,3}', '{4.4,5,6}'], // [[1.1, 2, 3], [4.4, 5, 6]], // ['{1.1,2,3}', '{4.4,5,6}'], //'{"{1.1,2,3}","{4.4,5,6}"}',
		['ok', 'happy', `no,'"\`rm`], // '{ok,happy,"no,\'\\"`rm"}', //
		['550e8400-e29b-41d4-a716-446655440000'],
	];

	const query = sql`insert into ${sql.identifier('all_array_data_types')} values ${
		sql.values([allArrayDataTypesValues])
	};`;
	// console.log(query.toSQL());
	await query;

	const res = await sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });
	// if (!Array.isArray(res[0]![18])) {
	// 	console.log(sql);
	// }

	expect(res[0]).toStrictEqual(expectedRes);
	// await dropAllArrayDataTypesTable(sql);
});

test('all nd-array types in sql.values test', async () => {
	await createAllNdarrayDataTypesTable(sql);

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
		[[new Date('2024-10-31T00:00:00.000Z')], [new Date('2024-10-31T00:00:00.000Z')]],
		[['1 day'], ['1 day']], // `{{"1 day"},{"1 day"}}`,
		[['(1,2)'], ['(1,2)']], // [[[1, 2]], [[1, 2]]], // [[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]],
		[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']], // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]], // '{{"{1.1,2,3}","{4.4,5,6}"},{"{1.1,2,3}","{4.4,5,6}"}}',
		[['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]], // '{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}',
		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
	];

	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes1);
	// await dropAllNdarrayDataTypesTable(sql);
});

// sql.stream: not implemented yet

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		query: 'select * from "users" where id = $1 or id = $2 and email = $3',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = $1 or id = $2 and email = $3',
		params: [1, 2, 'hello@test.com'],
	});
});

test('embeding SQLQuery and SQLTemplate test', async () => {
	await dropUsersTable(sql);
	await createUsersTable(sql);

	await sql`insert into users values ${
		sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
	}`;

	await sql`select * from ${sql.identifier('users')};`;
	// console.log(res);

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	// console.log(query1.toSQL());
	// console.log(await query1);
	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	// console.log(query2.toSQL());
	// console.log(await query2);
	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	// console.log(query3.toSQL());
	const res3 = await query3;
	// console.log(res3);
	expect(res3.length).not.toBe(0);

	await dropUsersTable(sql);
});
