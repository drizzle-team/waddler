import Database from 'better-sqlite3';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { type BetterSqlite3SQL, sql as sqlQuery, waddler } from 'waddler/better-sqlite3';
import { commonTests } from '../../common.test';
import {
	commonSqliteTests,
	createAllDataTypesTable,
	createUsersTable,
	dropAllDataTypesTable,
	dropUsersTable,
} from '../sqlite-core';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

let sql: BetterSqlite3SQL;

beforeAll(async () => {
	const client = new Database();
	sql = waddler({ client });
});

beforeEach<{ sql: BetterSqlite3SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonSqliteTests();

test('connection test', async () => {
	const sql1 = waddler();
	await sql1`select 1;`;

	const sql3 = waddler('');
	await sql3`select 3;`;

	const client = new Database();
	const sql4 = waddler({ client });
	await sql4`select 4;`;

	const sql5 = waddler({ connection: { fileMustExist: false, source: '' } });
	await sql5`select 5;`;
});

test('logger test', async () => {
	const loggerQuery = 'select ?;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	const logger = {
		logQuery: (query: string, params: unknown[]) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
		},
	};

	let loggerSql: BetterSqlite3SQL;

	// case 0
	const client = new Database();
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	loggerSql = waddler('', { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler('', { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler('', { logger: false });
	await loggerSql`select ${1};`;
	consoleMock.mockRestore();
});

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const values = [
		2147483647,
		BigInt('9007199254740992') + BigInt(1),
		101.23,
		'qwerty',
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		BigInt('9007199254740992') + BigInt(1),
		Buffer.from('qwerty'),
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		10.23,
	];

	await sql.unsafe(
		`insert into all_data_types values (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		values,
	).run();

	const res = await sql.unsafe(`select * from all_data_types;`);

	const expectedRes = {
		integer_number: 2147483647,
		integer_bigint: 9007199254740992, // it will return right bigint( BigInt('9007199254740992') + BigInt(1), ) if you call client.defaultSafeIntegers(true);
		real: 101.23,
		text: 'qwerty',
		text_json: JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		blob_bigint: 9007199254740992, // it will return right bigint( BigInt('9007199254740992') + BigInt(1), ) if you call client.defaultSafeIntegers(true);
		blob_buffer: Buffer.from('qwerty'),
		blob_json: JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		numeric: 10.23,
	};

	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();
	expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const allDataTypesValues = [
		2147483647,
		BigInt('9007199254740992') + BigInt(1),
		101.23,
		'qwerty',
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		BigInt('9007199254740992') + BigInt(1),
		Buffer.from('qwerty'),
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		10.23,
	];

	const expectedRes = [
		2147483647,
		9007199254740992, // it will return right bigint( BigInt('9007199254740992') + BigInt(1), ) if you call client.defaultSafeIntegers(true);
		101.23,
		'qwerty',
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		9007199254740992, // it will return right bigint( BigInt('9007199254740992') + BigInt(1), ) if you call client.defaultSafeIntegers(true);
		Buffer.from('qwerty'),
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		10.23,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`.run();

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();

	expect(res[0]).toStrictEqual(expectedRes);
});

// sql.stream, sql.unsafe(...).stream()
test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const allDataTypesValues = [
		2147483647,
		BigInt('9007199254740992') + BigInt(1),
		101.23,
		'qwerty',
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		BigInt('9007199254740992') + BigInt(1),
		Buffer.from('qwerty'),
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		10.23,
	];

	const expectedRes = [
		2147483647,
		9007199254740992, // it will return right bigint( BigInt('9007199254740992') + BigInt(1), ) if you call client.defaultSafeIntegers(true);
		101.23,
		'qwerty',
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		9007199254740992, // it will return right bigint( BigInt('9007199254740992') + BigInt(1), ) if you call client.defaultSafeIntegers(true);
		Buffer.from('qwerty'),
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}),
		10.23,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`.run();

	const queryStream = sql`select * from ${sql.identifier('all_data_types')}`.stream();
	for await (const row of queryStream) {
		expect(Object.values(row)).toStrictEqual(expectedRes);
	}

	// sql.unsafe(...).stream()
	const unsafeQueryStream = sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).stream();
	for await (const row of unsafeQueryStream) {
		expect(row).toStrictEqual(expectedRes);
	}
});

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = ? or id = ? and email = ?;',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = ? or id = ? and email = ?',
		params: [1, 2, 'hello@test.com'],
	});
});

test('embeding SQLQuery and SQLTemplate test #1', async () => {
	await dropUsersTable(sql);
	await createUsersTable(sql);

	await sql`insert into users values ${
		sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
	}`.run();

	await sql`select * from ${sql.identifier('users')};`;

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	expect(query1.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = ? and name = ?;',
		params: [1, 'a'],
	});

	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = ? and name = ?;',
		params: [1, 'a'],
	});

	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select * from "users" where id = ?;',
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
