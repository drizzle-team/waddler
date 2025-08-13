import type Docker from 'dockerode';
import type { Client as ClientT } from 'pg';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler';
import { queryStream } from 'waddler/extensions/pg-query-stream';
import { sql as sqlQuery, waddler } from 'waddler/node-postgres';
import { commonTests } from '../../common.test.ts';
import { createPgDockerDB } from '../../utils.ts';
import {
	commonPgTests,
	createAllDataTypesTable,
	createUsersTable,
	defaultValue,
	dropAllDataTypesTable,
	dropUsersTable,
	nodePgTests,
} from '../pg-core.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

const { Client, Pool } = pg;

let pgContainer: Docker.Container;
let pgClient: ClientT;
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
			pgClient = new Client(dockerPayload.connectionParams);
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

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

test('connection test', async () => {
	const client = new Client({ ...pgConnectionParams });
	await client.connect();
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	const sql12 = waddler({ client });
	await sql12`select 12;`;
	await client.end();

	const pool = new Pool({ ...pgConnectionParams });
	const sql2 = waddler({ client: pool });
	await sql2`select 2;`;

	const sql22 = waddler({ client: pool });
	await sql22`select 22;`;
	await pool.end();

	// TODO fix the code below
	// const connectionString =
	// 	`postgresql://${pgConnectionParams.user}:${pgConnectionParams.password}@${pgConnectionParams.host}:${pgConnectionParams.port}/${pgConnectionParams.database}`;

	// console.log(connectionString);

	// const sql3 = waddler(connectionString);
	// await sql3`select 3;`;
});

test('logger test', async () => {
	const loggerQuery = 'select $1;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	// metadata example:
	// 	{
	//   command: 'SELECT',
	//   rowCount: 1,
	//   oid: null,
	//   fields: [
	//     Field {
	//       name: '?column?',
	//       tableID: 0,
	//       columnID: 0,
	//       dataTypeID: 25,
	//       dataTypeSize: -1,
	//       dataTypeModifier: -1,
	//       format: 'text'
	//     }
	//   ],
	//   _parsers: [ [Function: noParse] ],
	//   _types: { getTypeParser: [Function: getTypeParser] },
	//   RowCtor: null,
	//   rowAsArray: false,
	//   _prebuiltEmptyResultObject: { '?column?': null }
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
	loggerSql = waddler({ client: pgClient, logger });
	await loggerSql`select ${1};`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client: pgClient, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client: pgClient, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	// TODO fix case below
	// const connectionString =
	// 	`postgresql://${pgConnectionParams.user}:${pgConnectionParams.password}@${pgConnectionParams.host}:${pgConnectionParams.port}/${pgConnectionParams.database}`;
	// loggerSql = waddler(connectionString, { logger });
	// await loggerSql`select ${1};`;

	// loggerSql = waddler(connectionString, { logger: true });
	// await loggerSql`select ${1};`;
	// expect(consoleMock).toBeCalledWith(loggerText);

	// loggerSql = waddler(connectionString, { logger: false });
	// await loggerSql`select ${1};`;

	consoleMock.mockRestore();
});

nodePgTests();

// sql.stream
test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
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
	} as Record<string, any>;

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const client = new Client({ ...pgConnectionParams });
	await client.connect();
	const sqlClient = waddler({ client, extensions: [queryStream()] });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(row).toStrictEqual(expectedRes);
	}

	await client.end();

	const pool = new Pool({ ...pgConnectionParams });
	const sqlPool = waddler({ client: pool, extensions: [queryStream()] });
	const streamPool = sqlPool`select * from all_data_types;`.stream();
	for await (const row of streamPool) {
		// expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		// const predicate = Object.entries(row).every(([colName, colValue]) =>
		// 	vitestExpectSoftDate(colValue, expectedRes[colName])
		// );
		// expect(predicate).toBe(true);
		expect(row).toStrictEqual(expectedRes);
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
