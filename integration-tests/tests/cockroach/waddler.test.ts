import type Docker from 'dockerode';
import type { Client as ClientT } from 'pg';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler';
import { sql as sqlQuery, waddler } from 'waddler/cockroach';
import { queryStream } from 'waddler/extensions/pg-query-stream';
import { commonTests } from '../common.test.ts';
import { commonPgTests } from '../pg/pg-core.ts';
import { createCockroachDockerDB, parseEWKB, vitestExpectSoftDate } from '../utils.ts';
import {
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	createUsersTable,
	defaultValue,
	dropAllArrayDataTypesTable,
	dropAllDataTypesTable,
	dropUsersTable,
} from './cockroach-core';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

const { Client, Pool } = pg;

let cockroachContainer: Docker.Container;
let cockroachClient: ClientT;
let cockroachConnectionParams: {
	host: string;
	port: number;
	user: string;
	password: string | undefined;
	database: string;
	ssl: boolean;
};
let cockroachConnectionString: string;

let sql: SQL;
beforeAll(async () => {
	const { connectionString, container, connectionParams } = await createCockroachDockerDB();
	cockroachConnectionString = connectionString;
	cockroachContainer = container;
	cockroachConnectionParams = connectionParams;

	const sleep = 1000;
	let timeLeft = 40000;
	let connected = false;
	let lastError: unknown | undefined;
	do {
		try {
			cockroachClient = new Client({ connectionString });
			await cockroachClient.connect();
			sql = waddler({ client: cockroachClient });
			connected = true;
			break;
		} catch (e) {
			lastError = e;
			await new Promise((resolve) => setTimeout(resolve, sleep));
			timeLeft -= sleep;
		}
	} while (timeLeft > 0);
	if (!connected) {
		console.error('Cannot connect to Cockroach');
		await cockroachClient?.end().catch(console.error);
		await cockroachContainer?.stop().catch(console.error);
		throw lastError;
	}
});

afterAll(async () => {
	await cockroachClient?.end().catch(console.error);
	await cockroachContainer?.stop().catch(console.error);
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

test('connection test', async () => {
	const client = new Client({ ...cockroachConnectionParams });
	await client.connect();
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	const sql12 = waddler({ client });
	await sql12`select 12;`;
	await client.end();

	const pool = new Pool({ ...cockroachConnectionParams });
	const sql2 = waddler({ client: pool });
	await sql2`select 2;`;

	const sql22 = waddler({ client: pool });
	await sql22`select 22;`;
	await pool.end();

	const sql3 = waddler(cockroachConnectionString);
	await sql3`select 3;`;
});

test('logger test', async () => {
	const loggerQuery = 'select $1::int;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	// metadata example:
	// {
	//   command: 'SELECT',
	//   rowCount: 1,
	//   oid: null,
	//   fields: [
	//     Field {
	//       name: 'int8',
	//       tableID: 0,
	//       columnID: 0,
	//       dataTypeID: 20,
	//       dataTypeSize: 8,
	//       dataTypeModifier: -1,
	//       format: 'text'
	//     }
	//   ],
	//   _parsers: [ [Function: parseBigInteger] ],
	//   _types: { getTypeParser: [Function: getTypeParser] },
	//   RowCtor: null,
	//   rowAsArray: false,
	//   _prebuiltEmptyResultObject: { int8: null }
	// }
	const logger = {
		logQuery: (query: string, params: unknown[], metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
			const metadataKeys = Object.keys(metadata);
			const predicate = ['command', 'rowCount', 'oid', 'fields'].map((key) => metadataKeys.includes(key)).every(
				(value) => value === true,
			);
			expect(predicate).toBe(true);
		},
	};

	let loggerSql: SQL;

	// case 0
	loggerSql = waddler({ client: cockroachClient, logger });
	await loggerSql`select ${1}::int;`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client: cockroachClient, logger: true });
	await loggerSql`select ${1}::int;`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client: cockroachClient, logger: false });
	await loggerSql`select ${1}::int;`;

	// case 1
	loggerSql = waddler(cockroachConnectionString, { logger });
	await loggerSql`select ${1}::int;`;

	loggerSql = waddler(cockroachConnectionString, { logger: true });
	await loggerSql`select ${1}::int;`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler(cockroachConnectionString, { logger: false });
	await loggerSql`select ${1}::int;`;

	consoleMock.mockRestore();
});

test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};
	const values = [
		2,
		4,
		BigInt('9007199254740992') + BigInt(1),
		10.1,
		100.12,
		1000.123,
		10000.1234,
		true,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		'10101',
		json,
		'14:25:29.425',
		date,
		'2024-10-31',
		'1 day',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		'192.168.0.2/10',
		'SRID=4326;POINT(1 2)',
		'[1,2,3]',
	];

	await sql.unsafe(
		`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, default);`,
		values,
	);

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'object' });

	const expectedRes = {
		int2: 2,
		int4: 4,
		int8: String(BigInt('9007199254740992') + BigInt(1)),
		numeric: '10.1',
		decimal: '100.12',
		real: 1000.123,
		double_precision: 10000.1234,
		boolean: true,
		char: `qwe'"\`rty`,
		varchar: `qwe'"\`rty`,
		string: `qwe'"\`rty`,
		bit: '10101',
		jsonb: json,
		time: '14:25:29.425',
		timestamp: date,
		date: new Date('2024-10-31T00:00:00.000'),
		interval: '1 day',
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		inet: '192.168.0.2/10',
		geometry: [1, 2], // 'SRID=4326;POINT(1 2)'
		vector: '[1,2,3]', // [1, 2, 3]
		default: defaultValue,
	} as Record<string, any>;

	res[0]!['geometry'] = parseEWKB(res[0]!['geometry']);
	expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
	let predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
		vitestExpectSoftDate(colValue, expectedRes[colName])
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);

	// same as select query above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	// parsing geometry point
	arrayResult[0]![20] = parseEWKB(arrayResult[0]![20]);

	expect(Object.keys(arrayResult[0]!).length).toBe(Object.keys(expectedRes).length);
	predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(arrayResult[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));

	await dropAllDataTypesTable(sql);
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};
	const allDataTypesValues = [
		2,
		4,
		BigInt('9007199254740992') + BigInt(1),
		10.1,
		100.12,
		1000.123,
		10000.1234,
		true,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		'10101',
		json,
		'14:25:29.425',
		date,
		'2024-10-31',
		'1 day',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		'192.168.0.2/10',
		'SRID=4326;POINT(1 2)',
		'[1,2,3]',
		sql.default,
	];

	const expectedRes = [
		2,
		4,
		String(BigInt('9007199254740992') + BigInt(1)),
		'10.1',
		'100.12',
		1000.123,
		10000.1234,
		true,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		'10101',
		json,
		'14:25:29.425',
		date,
		new Date('2024-10-31T00:00:00.000'),
		'1 day',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		'192.168.0.2/10',
		[1, 2], // 'SRID=4326;POINT(1 2)'
		'[1,2,3]', // [1, 2, 3]
		defaultValue,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	// parsing geometry point
	res[0]![20] = parseEWKB(res[0]![20]);

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);
	await dropAllDataTypesTable(sql);
});

test('all array types in sql.values test', async () => {
	await createAllArrayDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const allArrayDataTypesValues = [
		[2],
		[4],
		[BigInt('9007199254740992') + BigInt(1)],
		[10.1],
		[100.12],
		[1000.123],
		[10000.1234],
		[true],
		[`qwe'"\`rty`],
		[`qwe'"\`rty`],
		[`qwe'"\`rty`],
		['10101'],
		['14:25:29.425'],
		[date],
		['2024-10-31'],
		['1 day'],
		[`no,'"\`rm`],
		['550e8400-e29b-41d4-a716-446655440000'],
		['192.168.0.2/10'],
		['SRID=4326;POINT(1 2)'],
	];

	const expectedRes = [
		[2],
		[4],
		[`${BigInt('9007199254740992') + BigInt(1)}`],
		[10.1],
		[100.12],
		[1000.123],
		[10000.1234],
		[true],
		[`qwe'"\`rty`],
		[`qwe'"\`rty`],
		[`qwe'"\`rty`],
		'{10101}', // ['10101'],
		['14:25:29.425'],
		[date],
		['2024-10-31'],
		'{"1 day"}', // ['1 day'],
		'{"no,\'\\"`rm"}', // [`no,'"\`rm`],
		['550e8400-e29b-41d4-a716-446655440000'],
		['192.168.0.2/10'],
		'{0101000020E6100000000000000000F03F0000000000000040}', // [[1,2]],
	];

	await sql`insert into ${sql.identifier('all_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes1);

	await dropAllArrayDataTypesTable(sql);
});

// sql.stream
test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};
	const allDataTypesValues = [
		2,
		4,
		BigInt('9007199254740992') + BigInt(1),
		10.1,
		100.12,
		1000.123,
		10000.1234,
		true,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		'10101',
		json,
		'14:25:29.425',
		date,
		'2024-10-31',
		'1 day',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		'192.168.0.2/10',
		'SRID=4326;POINT(1 2)',
		'[1,2,3]',
		sql.default,
	];

	const expectedRes = {
		int2: 2,
		int4: 4,
		int8: String(BigInt('9007199254740992') + BigInt(1)),
		numeric: '10.1',
		decimal: '100.12',
		real: 1000.123,
		double_precision: 10000.1234,
		boolean: true,
		char: `qwe'"\`rty`,
		varchar: `qwe'"\`rty`,
		string: `qwe'"\`rty`,
		bit: '10101',
		jsonb: json,
		time: '14:25:29.425',
		timestamp: date,
		date: new Date('2024-10-31T00:00:00.000'),
		interval: '1 day',
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		inet: '192.168.0.2/10',
		geometry: [1, 2], // 'SRID=4326;POINT(1 2)'
		vector: '[1,2,3]', // [1, 2, 3]
		default: defaultValue,
	} as Record<string, any>;

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const client = new Client({ ...cockroachConnectionParams });
	await client.connect();
	const sqlClient = waddler({ client, extensions: [queryStream()] });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		row['geometry'] = parseEWKB(row['geometry']);
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.entries(row).every(([colName, colValue]) =>
			vitestExpectSoftDate(colValue, expectedRes[colName])
		);
		expect(predicate).toBe(true);
		// expect(row).toStrictEqual(expectedRes);
	}

	await client.end();

	const pool = new Pool({ ...cockroachConnectionParams });
	const sqlPool = waddler({ client: pool, extensions: [queryStream()] });
	const streamPool = sqlPool`select * from all_data_types;`.stream();
	for await (const row of streamPool) {
		row['geometry'] = parseEWKB(row['geometry']);
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.entries(row).every(([colName, colValue]) =>
			vitestExpectSoftDate(colValue, expectedRes[colName])
		);
		expect(predicate).toBe(true);
		// expect(row).toStrictEqual(expectedRes);
	}

	await pool.end();
});

test('sql query api test', async () => {
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

test('standalone sql test', async () => {
	const timestampSelector = sqlQuery`toStartOfHour(${sqlQuery.identifier('test')})`;
	const timestampFilter =
		sqlQuery`${sqlQuery``}${timestampSelector} >= from and ${timestampSelector} < to${sqlQuery``}${sqlQuery`;`}`;

	expect(timestampFilter.toSQL()).toStrictEqual({
		sql: 'toStartOfHour("test") >= from and toStartOfHour("test") < to;',
		params: [],
	});
});

test('insert benchmark', async () => {
	await sql.unsafe(`create table tests(
	id    integer
);
  `);

	const valuesIds = Array.from({ length: 10 ** 4 }).fill([1]) as number[][];

	console.time('insert');
	await sql`insert into ${sql.identifier('tests')} values ${sql.values(valuesIds)};`;
	console.timeEnd('insert');
	// console.log('New user created!');
	// const ids = await sql`select * from ${sql.identifier('tests')};`.query();
	// console.log('Getting all users from the database:', ids);

	await sql.unsafe(`drop table tests;`);
});
