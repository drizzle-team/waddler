import type Docker from 'dockerode';
import mysqlCallback from 'mysql2';
import type { Connection } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler';
import { sql as sqlQuery, waddler } from 'waddler/mysql2';
import { commonTests } from '../../common.test';
import { createMysqlDockerDB } from '../../utils';
import {
	commonMysqlAllTypesTests,
	commonMysqlTests,
	createAllDataTypesTable,
	createUsersTable,
	defaultValue,
	dropAllDataTypesTable,
	dropUsersTable,
} from '../mysql-core';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

let mysqlContainer: Docker.Container;
let mysqlClient: Connection;
let mysqlConnectionParams: {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
};

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	const dockerPayload = await createMysqlDockerDB();
	const sleep = 1000;
	let timeLeft = 40000;
	let connected = false;
	let lastError;

	mysqlContainer = dockerPayload.mysqlContainer;
	do {
		try {
			mysqlConnectionParams = dockerPayload.connectionParams;
			mysqlClient = await mysql.createConnection(dockerPayload.connectionParams);
			// await mysqlClient.connect();
			sql = waddler({ client: mysqlClient });
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
		await mysqlClient?.end().catch(console.error);
		await mysqlContainer?.stop().catch(console.error);
		throw lastError;
	}
});

afterAll(async () => {
	await mysqlClient?.end().catch(console.error);
	await mysqlContainer?.stop().catch(console.error);
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

test('connection test', async () => {
	// pool(promise)
	const pool = mysql.createPool({ ...mysqlConnectionParams });
	const sql1 = waddler({ client: pool });
	await sql1`select 1;`;

	await pool.end();

	// connection(promise)
	const connection = await mysql.createConnection(mysqlConnectionParams);
	const sql12 = waddler({ client: connection });
	await sql12`select 12;`;

	// pool(callback)
	const poolCallback = mysqlCallback.createPool({ ...mysqlConnectionParams });
	const sql13 = waddler({ client: poolCallback });
	await sql13`select 13;`;

	poolCallback.end();

	// connection(callback)
	const connectionCallback = mysqlCallback.createConnection({ ...mysqlConnectionParams });
	const sql14 = waddler({ client: connectionCallback });
	await sql14`select 14;`;

	connectionCallback.end();

	// configs
	const sql2 = waddler({ connection: mysqlConnectionParams });
	await sql2`select 2;`;

	const url =
		`mysql://${mysqlConnectionParams.user}:${mysqlConnectionParams.password}@${mysqlConnectionParams.host}:${mysqlConnectionParams.port}/${mysqlConnectionParams.database}`;
	const sql21 = waddler({ connection: url });
	await sql21`select 21;`;

	const sql22 = waddler(url);
	await sql22`select 22;`;

	const sql23 = waddler({ connection: { uri: url } });
	await sql23`select 23;`;
});

test('logger test', async () => {
	const loggerQuery = 'select ?;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	// metadata example:
	// [
	// 	{
	// 		catalog: 'def',
	// 		schema: '',
	// 		name: '1',
	// 		orgName: '',
	// 		table: '',
	// 		orgTable: '',
	// 		characterSet: 63,
	// 		encoding: 'binary',
	// 		columnLength: 2,
	// 		type: 8,
	// 		flags: [ 'NOT NULL' ],
	// 		decimals: 0,
	// 		typeName: 'LONGLONG'
	// 	}
	// ]
	const logger = {
		logQuery: (query: string, params: unknown[], metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
			expect(Array.isArray(metadata)).toBe(true);
		},
	};

	let loggerSql: SQL;

	// case 0
	const pool = mysql.createPool({ ...mysqlConnectionParams });
	loggerSql = waddler({ client: pool, logger });
	await loggerSql`select ${1};`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client: pool, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client: pool, logger: false });
	await loggerSql`select ${1};`;

	await pool.end();

	// case 1
	const url =
		`postgres://${mysqlConnectionParams.user}:${mysqlConnectionParams.password}@${mysqlConnectionParams.host}:${mysqlConnectionParams.port}/${mysqlConnectionParams.database}`;

	loggerSql = waddler(url, { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(url, { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler(url, { logger: false });
	await loggerSql`select ${1};`;

	consoleMock.mockRestore();
});

commonTests();
commonMysqlTests();

// ALL TYPES with sql.unsafe and sql.values-------------------------------------------------------------------
commonMysqlAllTypesTests('mysql2');

// sql.stream
test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

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
		'qwerty',
		'qwerty',
		'qwerty',
		'qwerty',
		'qwerty',
		true,
		new Date('2024-10-31T00:00:00.000'), // '2024-10-31',
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
		sql.default,
	];

	const expectedRes = {
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

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	// connection(promise)
	const connection = await mysql.createConnection({ ...mysqlConnectionParams });
	const sqlClient = waddler({ client: connection });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(row).toStrictEqual(expectedRes);
	}

	await connection.end();

	// pool(promise)
	const pool = mysql.createPool({ ...mysqlConnectionParams });
	const sql1 = waddler({ client: pool });
	const sql1Stream = sql1`select * from all_data_types;`.stream();
	for await (const row of sql1Stream) {
		expect(row).toStrictEqual(expectedRes);
	}

	await pool.end();

	// pool(callback)
	const poolCallback = mysqlCallback.createPool({ ...mysqlConnectionParams });
	const sql13 = waddler({ client: poolCallback });
	const sql13Stream = sql13`select * from all_data_types;`.stream();
	for await (const row of sql13Stream) {
		expect(row).toStrictEqual(expectedRes);
	}

	poolCallback.end();

	// connection(callback)
	const connectionCallback = mysqlCallback.createConnection({ ...mysqlConnectionParams });
	const sql14 = waddler({ client: connectionCallback });
	const sql14Stream = sql14`select * from all_data_types;`.stream();
	for await (const row of sql14Stream) {
		expect(row).toStrictEqual(expectedRes);
	}

	connectionCallback.end();
});

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ? or id = ? and email = ?;',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = ? or id = ? and email = ?',
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

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	expect(query1.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ? and name = ?;',
		params: [1, 'a'],
	});

	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ? and name = ?;',
		params: [1, 'a'],
	});

	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ?;',
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
		sql: 'toStartOfHour(`test`) >= from and toStartOfHour(`test`) < to;',
		params: [],
	});
});
