import type Docker from 'dockerode';
import mysqlCallback from 'mysql2';
import type { Connection } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { createAllDataTypesTable, defaultValue, dropAllDataTypesTable } from 'tests/mysql-core';
import { createMysqlDockerDB } from 'tests/utils';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { SQL } from '~/sql';
import { waddler } from '../../src/mysql2';

let mysqlContainer: Docker.Container;
let mysqlClient: Connection;
let mysqlConnectionParams: {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
};

let sql: SQL;
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
			// TODO: check later: do I really need to call client.connect?
			await mysqlClient.connect();
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

test('connection test', async () => {
	// pool(promise)
	const pool = mysql.createPool({ ...mysqlConnectionParams });
	const sql1 = waddler({ client: pool });
	await sql1`select 1;`;

	const sql11 = waddler(pool);
	await sql11`select 11;`;

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
		`postgres://${mysqlConnectionParams.user}:${mysqlConnectionParams.password}@${mysqlConnectionParams.host}:${mysqlConnectionParams.port}/${mysqlConnectionParams.database}`;
	const sql21 = waddler({ connection: url });
	await sql21`select 21;`;

	const sql22 = waddler(url);
	await sql22`select 22;`;

	const sql23 = waddler({ connection: { uri: url } });
	await sql23`select 23;`;
});

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');

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
		new Date('2024-10-31T14:25:29.425Z'), // '2024-10-31',
		new Date('2024-10-31T14:25:29.425Z'),
		'14:25:29',
		2024,
		new Date('2024-10-31T14:25:29.425Z'),
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		`known`,
		// sql.default,
	];

	await sql.unsafe(
		`insert into all_data_types values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, default);`,
		values,
		{ rowMode: 'object' },
	);

	const res = await sql.unsafe(`select * from all_data_types;`);

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);
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
		date: new Date('2024-10-30T22:00:00.000Z'), // '2024-10-31',
		datetime: new Date('2024-10-31T16:25:29'),
		time: '14:25:29',
		year: 2024,
		timestamp: new Date('2024-10-31T16:25:29'),
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

	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
	expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values test', async () => {
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
		new Date('2024-10-31T22:00:00.000Z'), // '2024-10-31',
		new Date('2024-10-31T12:25:29Z'),
		'14:25:29',
		2024,
		new Date('2024-10-31T14:25:29.425Z'),
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

	const expectedRes = [
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
		new Date('2024-10-31T22:00:00.000Z'), // '2024-10-31',
		new Date('2024-10-31T12:25:29Z'),
		'14:25:29',
		2024,
		new Date('2024-10-31T14:25:29Z'),
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

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes);
});

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
		new Date('2024-10-31T22:00:00.000Z'), // '2024-10-31',
		new Date('2024-10-31T12:25:29Z'),
		'14:25:29',
		2024,
		new Date('2024-10-31T14:25:29.425Z'),
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
		date: new Date('2024-10-31T22:00:00.000Z'), // '2024-10-31',
		datetime: new Date('2024-10-31T12:25:29Z'),
		time: '14:25:29',
		year: 2024,
		timestamp: new Date('2024-10-31T16:25:29'),
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

	const sql11 = waddler(pool);
	const sql11Stream = sql11`select * from all_data_types;`.stream();
	for await (const row of sql11Stream) {
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
