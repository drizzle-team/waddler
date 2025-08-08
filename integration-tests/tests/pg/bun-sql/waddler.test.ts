import { SQL as BunSql } from 'bun';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import type Docker from 'dockerode';
import { vi } from 'vitest';
import type { SQL } from 'waddler';
import { sql as sqlQuery, waddler } from 'waddler/bun-sql';
import {
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	createAllNdarrayDataTypesTable,
	createUsersTable,
	defaultValue,
	dropAllArrayDataTypesTable,
	dropAllDataTypesTable,
	dropAllNdarrayDataTypesTable,
	dropUsersTable,
} from '../../pg/pg-core';
import { createPgDockerDB } from '../../utils';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

let pgContainer: Docker.Container;
let pgClient: BunSql;
let pgConnectionParams: {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	ssl: boolean;
};

let sql: ReturnType<typeof waddler>;

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
			pgClient = new BunSql(pgConnectionParams);
			await pgClient.connect();
			sql = waddler({ client: pgClient });
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
});

afterAll(async () => {
	await pgClient?.end().catch(console.error);
	await pgContainer?.stop().catch(console.error);
});

// connection test
test('connection test', async () => {
	const client = new BunSql(pgConnectionParams);
	await client.connect();

	const sql2 = waddler({ client });
	await sql2`select 2;`;

	await client.end();

	const { host, port, user, password, database } = pgConnectionParams;
	const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
	const sql3 = waddler(connectionString);
	await sql3`select 3;`;

	const sql4 = waddler({ connection: connectionString });
	await sql4`select 4;`;

	const sql5 = waddler({ connection: { url: connectionString } });
	await sql5`select 5;`;

	const sql6 = waddler({ connection: pgConnectionParams });
	await sql6`select 6;`;
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
	const client = new BunSql(pgConnectionParams);
	await client.connect();
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(loggerText);

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	const { host, port, user, password, database } = pgConnectionParams;
	const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
	loggerSql = waddler(connectionString, { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(connectionString, { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(loggerText);

	loggerSql = waddler(connectionString, { logger: false });
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
		timestamp_date: date,
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

	await dropAllDataTypesTable(sql);
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

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
		date,
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
	await dropAllDataTypesTable(sql);
});

test('all array types in sql.values test', async () => {
	await createAllArrayDataTypesTable(sql);

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
		['20.4'],
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
		[new Date('2024-10-31T00:00:00.000Z')],
		['1 day'], // `{"1 day"}`,
		['(1,2)'], // [[1, 2]],
		['{1.1,2,3}', '{4.4,5,6}'], // '{"{1.1,2,3}","{4.4,5,6}"}', // [[1.1, 2, 3], [4.4, 5, 6]],
		'{ok,happy,"no,\'\\"`rm"}', // ['ok', 'happy', `no,'"\`rm`],
		'{550e8400-e29b-41d4-a716-446655440000}',
	];

	await sql`insert into ${sql.identifier('all_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes1);

	await dropAllArrayDataTypesTable(sql);
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
		[['(1,2)'], ['(1,2)']], // [[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]], // [[[1, 2]], [[1, 2]]],
		[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']], // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]],
		'{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}', // [['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
		'{{550e8400-e29b-41d4-a716-446655440000},{550e8400-e29b-41d4-a716-446655440000}}',
	];

	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes1);

	await dropAllNdarrayDataTypesTable(sql);
});

test('embeding SQLQuery and SQLTemplate test #1', async () => {
	await dropUsersTable(sql);
	await createUsersTable(sql);

	await sql`insert into users values ${
		sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
	}`;

	await sql`select * from ${sql.identifier('users')};`;

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	expect(query1.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = $1 and name = $2;',
		params: [1, 'a'],
	});

	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = $1 and name = $2;',
		params: [1, 'a'],
	});

	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = $1;',
		params: [1],
	});

	const res3 = await query3;
	expect(res3.length).not.toBe(0);

	await dropUsersTable(sql);
});

test('embeding SQLQuery and SQLTemplate test #2', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = $1 or id = $2 and email = $3;',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = $1 or id = $2 and email = $3',
		params: [1, 2, 'hello@test.com'],
	});
});

test('standalone sql test #1', async () => {
	const timestampSelector = sqlQuery`toStartOfHour(${sqlQuery.identifier('test')})`;
	const timestampFilter =
		sqlQuery`${sqlQuery``}${timestampSelector} >= from and ${timestampSelector} < to${sqlQuery``}${sqlQuery`;`}`;

	expect(timestampFilter.toSQL()).toStrictEqual({
		sql: 'toStartOfHour("test") >= from and toStartOfHour("test") < to;',
		params: [],
	});
});
