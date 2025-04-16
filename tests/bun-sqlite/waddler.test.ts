import Database from 'bun:sqlite';
import { beforeAll, expect, test } from 'bun:test';
import { createAllDataTypesTable, dropAllDataTypesTable } from 'tests/sqlite-core';
// import { beforeEach } from 'vitest';
import { type BunSqliteSQL, waddler } from '../../src/bun-sqlite';

let sql: BunSqliteSQL;

beforeAll(async () => {
	const client = new Database();
	sql = waddler(client);
});

test('connection test', async () => {
	const sql1 = waddler();
	await sql1`select 1;`;

	const client = new Database();
	const sql2 = waddler(client);
	await sql2`select 2;`;

	const sql3 = waddler('');
	await sql3`select 3;`;

	const sql4 = waddler({ client });
	await sql4`select 4;`;

	const sql5 = waddler({ connection: { source: '' } });
	await sql5`select 5;`;
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
	const unsafeQueryStream = sql.unsafe(
		`select * from all_data_types;`,
		[],
		{ rowMode: 'array' },
	).stream();
	for await (const row of unsafeQueryStream) {
		expect(row).toStrictEqual(expectedRes);
	}
});

// commonTests();
// commonSqliteTests();
