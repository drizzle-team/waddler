import { D1Database, D1DatabaseAPI } from '@miniflare/d1';
import { createSQLiteDB } from '@miniflare/shared';
import { commonTests } from 'tests/common.test';
import { commonSqliteTests, createAllDataTypesTable, dropAllDataTypesTable } from 'tests/sqlite-core';
import { beforeAll, beforeEach, expect, test } from 'vitest';
import { type D1SQL, waddler } from '../../src/d1';

let sql: D1SQL;

beforeAll(async () => {
	const sqliteDb = await createSQLiteDB(':memory:');
	const client = new D1Database(new D1DatabaseAPI(sqliteDb));
	sql = waddler(client);
});

beforeEach<{ sql: D1SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonSqliteTests();

test('connection test', async () => {
	const sqliteDb = await createSQLiteDB(':memory:');
	const client = new D1Database(new D1DatabaseAPI(sqliteDb));
	const sql1 = waddler(client);
	await sql1`select 1;`;
});

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const values = [
		2147483647,
		// D1 supports 64-bit signed INTEGER values internally, however BigInts ↗ are not currently supported in the API yet.
		// https://developers.cloudflare.com/d1/worker-api/
		// TODO: change to BigInt('9007199254740992') + BigInt(1) when D1 supports BigInt
		9007199254740992,
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
		9007199254740992,
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
		integer_bigint: 9007199254740992,
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
		blob_bigint: 9007199254740992,
		blob_buffer: [...new Uint8Array(Buffer.from('qwerty'))],
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
		9007199254740992, // BigInt('9007199254740992') + BigInt(1),
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
		9007199254740992, // BigInt('9007199254740992') + BigInt(1),
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
		9007199254740992,
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
		9007199254740992,
		[...new Uint8Array(Buffer.from('qwerty'))],
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
