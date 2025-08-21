import type Docker from 'dockerode';
import mssql from 'mssql';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { sql as sqlQuery } from 'waddler/mssql-core';
import type { NodeMsSqlSQL } from 'waddler/node-mssql';
import { AutoPool, waddler } from 'waddler/node-mssql';
import { commonTests } from '../common.test.ts';
import { createMsSqlDockerDB, vitestExpectSoftDate } from '../utils.ts';
import {
	commonMsSqlTests,
	createAllDataTypesTable,
	createUsersTable,
	defaultValue,
	dropAllDataTypesTable,
	dropUsersTable,
} from './mssql-core.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

let mssqlContainer: Docker.Container;
let mssqlClient: mssql.ConnectionPool;
let mssqlOptions: mssql.config;
let mssqlConnectionString: string;

let sql: NodeMsSqlSQL;
beforeAll(async () => {
	const { container, options, connectionString } = await createMsSqlDockerDB();
	mssqlContainer = container;
	mssqlOptions = options;
	mssqlConnectionString = connectionString;

	const sleep = 1000;
	let timeLeft = 40000;
	let connected = false;
	let lastError: unknown | undefined;
	do {
		try {
			mssqlClient = await mssql.connect(options);
			await mssqlClient.connect();
			sql = waddler({ client: mssqlClient });
			connected = true;
			break;
		} catch (e) {
			lastError = e;
			await new Promise((resolve) => setTimeout(resolve, sleep));
			timeLeft -= sleep;
		}
	} while (timeLeft > 0);
	if (!connected) {
		console.error('Cannot connect to MsSql');
		await mssqlClient?.close().catch(console.error);
		await mssqlContainer?.stop().catch(console.error);
		throw lastError;
	}
});

afterAll(async () => {
	await mssqlClient?.close().catch(console.error);
	await mssqlContainer?.stop().catch(console.error);
});

beforeEach<{ sql: NodeMsSqlSQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonMsSqlTests();

test('connection test', async () => {
	const client = await mssql.connect(mssqlOptions);
	await client.connect();
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	// TODO revise how come I keep getting "Caused by: ConnectionError: Connection is closed." error if I close connection inside test
	// await client.close();

	const pool = new AutoPool(mssqlOptions);
	const sql2 = waddler({ client: pool });
	await sql2`select 2;`;

	const sql3 = waddler({ client: pool });
	await sql3`select 3;`;

	const sql4 = waddler({ connection: mssqlConnectionString });
	await sql4`select 4;`;

	const sql5 = waddler({ connection: mssqlOptions });
	await sql5`select 5;`;

	const sql6 = waddler(mssqlConnectionString);
	await sql6`select 6;`;
});

test('logger test', async () => {
	const loggerQuery = 'select @p1;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	// metadata example:
	// { output: {}, rowsAffected: [ 1 ] }
	const logger = {
		logQuery: (query: string, params: unknown[], metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
			const metadataKeys = Object.keys(metadata);
			const predicate = ['output', 'rowsAffected'].map((key) => metadataKeys.includes(key)).every(
				(value) => value === true,
			);
			expect(predicate).toBe(true);
		},
	};

	let loggerSql: NodeMsSqlSQL;

	// case 0
	loggerSql = waddler({ client: mssqlClient, logger });
	await loggerSql`select ${1};`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client: mssqlClient, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client: mssqlClient, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	loggerSql = waddler(mssqlConnectionString, { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(mssqlConnectionString, { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler(mssqlConnectionString, { logger: false });
	await loggerSql`select ${1};`;

	consoleMock.mockRestore();
});

test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const values = [
		2,
		4,
		6,
		BigInt('9007199254740992') + BigInt(1),
		10.1,
		100.12,
		1000.123,
		10000.1234,
		Buffer.from(`qwe'"\`rty`),
		Buffer.from(`qwe'"\`rty`),
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		true,
		'2024-10-31',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'14:25:29.425',
	];

	// TODO revise now param's placeholder should be named as waddler escapes param
	await sql.unsafe(
		`insert into all_data_types values (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14, @p15, @p16, @p17, @p18, @p19, @p20, @p21, @p22, @p23, default);`,
		values,
		{
			getParamName: (lastParamNumber: number) => {
				return `p${lastParamNumber}`;
			},
		},
	);

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'object' });

	const expectedRes = {
		tinyint: 2,
		smallint: 4,
		integer: 6,
		bigint: '9007199254740993',
		real: 10.100000381469727,
		decimal: 100.12,
		numeric: 1000.123,
		float: 10000.1234,
		binary: Buffer.from(`qwe'"\`rty`),
		varbinary: Buffer.from(`qwe'"\`rty`),
		char: `qwe'"\`rty`,
		varchar: `qwe'"\`rty`,
		text: `qwe'"\`rty`,
		bit: true,
		date_string: '2024-10-31',
		date: date,
		datetime_string: '2024-10-31T14:25:29.425',
		datetime: date,
		datetime2_string: '2024-10-31T14:25:29.425',
		datetime2: date,
		datetime_offset_string: '2024-10-31T14:25:29.425',
		datetime_offset: date,
		time: '14:25:29.425',
		default: defaultValue,
	} as Record<string, any>;

	expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
	let predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
		vitestExpectSoftDate(colValue, expectedRes[colName])
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);

	// same as select query above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

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
	const allDataTypesValues = [
		2,
		4,
		6,
		BigInt('9007199254740992') + BigInt(1),
		10.1,
		100.12,
		1000.123,
		10000.1234,
		Buffer.from(`qwe'"\`rty`),
		Buffer.from(`qwe'"\`rty`),
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		true,
		'2024-10-31',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'14:25:29.425',
		sql.default,
	];

	const expectedRes = [
		2,
		4,
		6,
		'9007199254740993',
		10.100000381469727,
		100.12,
		1000.123,
		10000.1234,
		Buffer.from(`qwe'"\`rty`),
		Buffer.from(`qwe'"\`rty`),
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		true,
		'2024-10-31',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'14:25:29.425',
		defaultValue,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);
	await dropAllDataTypesTable(sql);
});

// sql.stream
test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const allDataTypesValues = [
		2,
		4,
		6,
		BigInt('9007199254740992') + BigInt(1),
		10.1,
		100.12,
		1000.123,
		10000.1234,
		Buffer.from(`qwe'"\`rty`),
		Buffer.from(`qwe'"\`rty`),
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		`qwe'"\`rty`,
		true,
		'2024-10-31',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'2024-10-31T14:25:29.425',
		date,
		'14:25:29.425',
		sql.default,
	];

	const expectedRes = {
		tinyint: 2,
		smallint: 4,
		integer: 6,
		bigint: '9007199254740993',
		real: 10.100000381469727,
		decimal: 100.12,
		numeric: 1000.123,
		float: 10000.1234,
		binary: Buffer.from(`qwe'"\`rty`),
		varbinary: Buffer.from(`qwe'"\`rty`),
		char: `qwe'"\`rty`,
		varchar: `qwe'"\`rty`,
		text: `qwe'"\`rty`,
		bit: true,
		date_string: '2024-10-31',
		date: date,
		datetime_string: '2024-10-31T14:25:29.425',
		datetime: date,
		datetime2_string: '2024-10-31T14:25:29.425',
		datetime2: date,
		datetime_offset_string: '2024-10-31T14:25:29.425',
		datetime_offset: date,
		time: '14:25:29.425',
		default: defaultValue,
	} as Record<string, any>;

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const client = await mssql.connect(mssqlOptions);
	await client.connect();
	const sqlClient = waddler({ client });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.entries(row).every(([colName, colValue]) =>
			vitestExpectSoftDate(colValue, expectedRes[colName])
		);
		expect(predicate).toBe(true);
		// expect(row).toStrictEqual(expectedRes);
	}

	// await client.close();

	const pool = new AutoPool(mssqlOptions);
	const sqlPool = waddler({ client: pool });
	const streamPool = sqlPool`select * from all_data_types;`.stream();
	for await (const row of streamPool) {
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.entries(row).every(([colName, colValue]) =>
			vitestExpectSoftDate(colValue, expectedRes[colName])
		);
		expect(predicate).toBe(true);
		// expect(row).toStrictEqual(expectedRes);
	}
});

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from [users] where id = @p1 or id = @p2 and email = @p3;',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = @p1 or id = @p2 and email = @p3',
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
		sql: 'select * from [users] where id = @p1 and name = @p2;',
		params: [1, 'a'],
	});

	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select * from [users] where id = @p1 and name = @p2;',
		params: [1, 'a'],
	});

	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select * from [users] where id = @p1;',
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
		sql: 'toStartOfHour([test]) >= from and toStartOfHour([test]) < to;',
		params: [],
	});
});

test('insert benchmark', async () => {
	await sql.unsafe(`create table tests(
	id    integer
);
  `);

	const valuesIds = Array.from({ length: 10 ** 3 }).fill([1]) as number[][];

	console.time('insert');
	await sql`insert into ${sql.identifier('tests')} values ${sql.values(valuesIds)};`;
	console.timeEnd('insert');
	// console.log('New user created!');
	// const ids = await sql`select * from ${sql.identifier('tests')};`.query();
	// console.log('Getting all users from the database:', ids);

	await sql.unsafe(`drop table tests;`);
});
