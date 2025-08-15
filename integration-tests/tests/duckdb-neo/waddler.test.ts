import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler/duckdb-neo';
import { sql as sqlQuery, waddler } from 'waddler/duckdb-neo';
import { commonTests } from '../common.test';
import { commonPgTests, createUsersTable, dropUsersTable } from '../pg/pg-core';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	sql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write' });
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

// TODO add test for streaming

// UNSAFE-------------------------------------------------------------------
test('all types test', async () => {
	await sql.unsafe(`create table all_types (
    smallint_ smallint,
    integer_ integer,
	bigint_ bigint,
    double_ double,
    varchar_ varchar,
	boolean_ boolean,
	time_ time,
	date_ date,
	timestamp_ timestamp,
	json_ json,
    arrayInt integer[3],
    listInt integer[]
    );`);

	const date = new Date('2024-10-31T14:25:29.425Z');
	await sql.unsafe(
		`insert into all_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
		[
			1,
			10,
			BigInt('9007199254740992') + BigInt(1),
			20.4,
			"qwe'rty",
			true,
			date,
			date,
			date,
			{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
			[1, 2, 3],
			[1, 2, 3, 4, 5],
		],
		{ rowMode: 'object' },
	);

	let res = await sql.unsafe(`select * from all_types;`);

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);
	const expectedRes = {
		smallint_: 1,
		integer_: 10,
		bigint_: BigInt('9007199254740993'),
		double_: 20.4,
		varchar_: "qwe'rty",
		boolean_: true,
		time_: '14:25:29.425',
		date_: dateWithoutTime,
		timestamp_: date,
		json_: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		arrayInt: [1, 2, 3],
		listInt: [1, 2, 3, 4, 5],
	};
	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	res = await sql.unsafe(`select * from all_types;`, [], { rowMode: 'array' });
	expect(res[0]).toStrictEqual(Object.values(expectedRes));

	// float
	await sql.unsafe(`create table float_table (
        float_ float
    );`);

	await sql.unsafe(
		`insert into float_table values ($1)`,
		[20.3],
		{ rowMode: 'object' },
	);

	res = await sql.unsafe(`select * from float_table;`);

	expect((res[0] as { float_: number })['float_'].toFixed(1)).toEqual('20.3');

	// map
	await sql.unsafe(`create table map_table (
        map_ map(map(varchar, integer), double)
    );`);

	await sql.unsafe(
		`insert into map_table values (
        MAP {MAP {'a': 42.001, 'b': -32.1}: 42.001, MAP {'a1': 42.001, 'b1': -32.1}: -32.1}
        )`,
		[],
		{ rowMode: 'object' },
	);

	const expectedMap = new Map([
		[new Map([['a', 42], ['b', -32]]), 42.001],
		[new Map([['a1', 42], ['b1', -32]]), -32.1],
	]);
	res = await sql.unsafe(`select * from map_table;`);

	expect(res[0]).toStrictEqual({ map_: expectedMap });

	// TODO: add tests for select when the columns are of type: map, struct, union, ...
});

test('sql.values test', async () => {
	await sql.unsafe(`create table all_data_types (
    smallint_ smallint,
    integer_ integer,
	bigint_ bigint,
    double_ double,
    varchar_ varchar,
	boolean_ boolean,
	time_ time,
	date_ date,
	timestamp_ timestamp,
	json_ json,
    arrayInt integer[3],
    listInt integer[]
    );`);

	const date = new Date('2024-10-31T14:25:29.425Z');
	const valuesToInsert = [
		1,
		10,
		BigInt('9007199254740992') + BigInt(1),
		20.4,
		"qwe'rty",
		true,
		date,
		date,
		date,
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		[1, 2, 3],
		[1, 2, 3, 4, 5],
	];
	await sql`insert into all_data_types values ${sql.values([valuesToInsert])};`;

	let res = await sql.unsafe(`select * from all_data_types;`);

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);
	const expectedRes = {
		smallint_: 1,
		integer_: 10,
		bigint_: BigInt('9007199254740993'),
		double_: 20.4,
		varchar_: "qwe'rty",
		boolean_: true,
		time_: '14:25:29.425',
		date_: dateWithoutTime,
		timestamp_: date,
		json_: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		arrayInt: [1, 2, 3],
		listInt: [1, 2, 3, 4, 5],
	};
	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
	expect(res[0]).toStrictEqual(Object.values(expectedRes));

	await sql.unsafe('drop table if exists all_data_types;');
});

test('array type test', async () => {
	await sql.unsafe(`create table array_table (
        arrayInt integer[3],
        arrayDouble double[3],
        arrayBoolean boolean[3],
        arrayBigint bigint[3],
		arrayDate date[3],
		arrayTime time[3],
		arrayTimestamp timestamp[3],
		arrayJson json[2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into array_table values ($1, $2, $3, $4, $5, $6, $7, $8);`, [
		[1, 2, 3],
		[1.5, 2.6, 3.9],
		[true, false, true],
		[
			BigInt('9007199254740992') + BigInt(1),
			BigInt('9007199254740992') + BigInt(3),
			BigInt('9007199254740992') + BigInt(5),
		],
		dates,
		dates,
		dates,
		[
			{ name: 'alex', age: 26, bookIds: [1, 2, 3], aliases: ['sasha', 'sanya'] },
			{ name: 'oleksii', age: 21, bookIds: [1, 2, 4], aliases: ['leha'] },
		],
	]);

	const res = await sql.unsafe('select * from array_table;');

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		arrayInt: [1, 2, 3],
		arrayDouble: [1.5, 2.6, 3.9],
		arrayBoolean: [true, false, true],
		arrayBigint: [BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
		arrayDate: datesWithoutTime,
		arrayTime: ['14:25:29.425', '14:25:29.425', '14:25:29.425'],
		arrayTimestamp: [
			new Date('2024-10-31T14:25:29.425Z'),
			new Date('2024-10-30T14:25:29.425Z'),
			new Date('2024-10-29T14:25:29.425Z'),
		],
		arrayJson: [
			{ name: 'alex', age: 26, bookIds: [1, 2, 3], aliases: ['sasha', 'sanya'] },
			{ name: 'oleksii', age: 21, bookIds: [1, 2, 4], aliases: ['leha'] },
		],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('nested 2d array type test', async () => {
	await sql.unsafe(`create table nested_array_table (
        arrayInt integer[3][2],
        arrayDouble double[3][2],
        arrayBoolean boolean[3][2],
        arrayBigint bigint[3][2],
		arrayDate date[3][2],
		arrayTime time[3][2],
		arrayTimestamp timestamp[3][2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_array_table values ($1, $2, $3, $4, $5, $6, $7);`, [
		[[1, 2, 3], [1, 2, 3]],
		[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]],
		[[true, false, true], [true, false, true]],
		[
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
		],
		[dates, dates],
		[dates, dates],
		[dates, dates],
	]);

	const res = await sql.unsafe('select * from nested_array_table;');

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		arrayInt: [[1, 2, 3], [1, 2, 3]],
		arrayDouble: [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]],
		arrayBoolean: [[true, false, true], [true, false, true]],
		arrayBigint: [
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
		],
		arrayDate: [datesWithoutTime, datesWithoutTime],
		arrayTime: [['14:25:29.425', '14:25:29.425', '14:25:29.425'], ['14:25:29.425', '14:25:29.425', '14:25:29.425']],
		arrayTimestamp: [
			[
				new Date('2024-10-31T14:25:29.425Z'),
				new Date('2024-10-30T14:25:29.425Z'),
				new Date('2024-10-29T14:25:29.425Z'),
			],
			[
				new Date('2024-10-31T14:25:29.425Z'),
				new Date('2024-10-30T14:25:29.425Z'),
				new Date('2024-10-29T14:25:29.425Z'),
			],
		],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('nested 3d array type test', async () => {
	await sql.unsafe(`create table nested_3d_array_table (
        arrayInt integer[3][2][2],
        arrayDouble double[3][2][2],
        arrayBoolean boolean[3][2][2],
        arrayBigint bigint[3][2][2],
		arrayDate date[3][2][2],
		arrayTime time[3][2][2],
		arrayTimestamp timestamp[3][2][2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_3d_array_table values ($1, $2, $3, $4, $5, $6, $7);`, [
		[[[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]],
		[[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]], [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]]],
		[[[true, false, true], [true, false, true]], [[true, false, true], [true, false, true]]],
		[
			[
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
			],
			[
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
			],
		],
		[[dates, dates], [dates, dates]],
		[[dates, dates], [dates, dates]],
		[[dates, dates], [dates, dates]],
	]);

	const res = await sql.unsafe('select * from nested_3d_array_table;');

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		arrayInt: [[[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]],
		arrayDouble: [[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]], [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]]],
		arrayBoolean: [[[true, false, true], [true, false, true]], [[true, false, true], [true, false, true]]],
		arrayBigint: [
			[
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
			],
			[
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
			],
		],
		arrayDate: [[datesWithoutTime, datesWithoutTime], [datesWithoutTime, datesWithoutTime]],
		arrayTime: [
			[
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
			],
			[
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
			],
		],
		arrayTimestamp: [
			[
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
			],
			[
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
			],
		],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('list type test', async () => {
	await sql.unsafe(`create table list_table (
        listInt integer[],
        listDouble double[],
        listBoolean boolean[],
        listBigint bigint[],
		listDate date[],
		listTime time[],
		listTimestamp timestamp[],
		listJson json[]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into list_table values ($1, $2, $3, $4, $5, $6, $7, $8);`, [
		[1, 2, 3, 1234, 34],
		[1.5, 2.6, 3.9, 100.345],
		[true, false],
		[
			BigInt('9007199254740992') + BigInt(1),
			BigInt('9007199254740992') + BigInt(3),
			BigInt('9007199254740992') + BigInt(5),
		],
		dates,
		dates,
		dates,
		[
			{ name: 'alex', age: 26, bookIds: [1, 2, 3], aliases: ['sasha', 'sanya'] },
			{ name: 'oleksii', age: 21, bookIds: [1, 2, 4], aliases: ['leha'] },
			{ name: 'oleksii', age: 24 },
		],
	]);

	const res = await sql.unsafe('select * from list_table;');

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		listInt: [1, 2, 3, 1234, 34],
		listDouble: [1.5, 2.6, 3.9, 100.345],
		listBoolean: [true, false],
		listBigint: [BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
		listDate: datesWithoutTime,
		listTime: ['14:25:29.425', '14:25:29.425', '14:25:29.425'],
		listTimestamp: [
			new Date('2024-10-31T14:25:29.425Z'),
			new Date('2024-10-30T14:25:29.425Z'),
			new Date('2024-10-29T14:25:29.425Z'),
		],
		listJson: [
			{ name: 'alex', age: 26, bookIds: [1, 2, 3], aliases: ['sasha', 'sanya'] },
			{ name: 'oleksii', age: 21, bookIds: [1, 2, 4], aliases: ['leha'] },
			{ name: 'oleksii', age: 24 },
		],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('nested 2d list type test', async () => {
	await sql.unsafe(`create table nested_list_table (
        listInt integer[][],
        listDouble double[][],
        listBoolean boolean[][],
        listBigint bigint[][],
		listDate date[][],
		listTime time[][],
		listTimestamp timestamp[][]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_list_table values ($1, $2, $3, $4, $5, $6, $7);`, [
		[[1, 2, 3], [1, 2, 3]],
		[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]],
		[[true, false, true], [true, false, true]],
		[
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
		],
		[dates, dates],
		[dates, dates],
		[dates, dates],
	]);

	const res = await sql.unsafe('select * from nested_list_table;');

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		listInt: [[1, 2, 3], [1, 2, 3]],
		listDouble: [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]],
		listBoolean: [[true, false, true], [true, false, true]],
		listBigint: [
			[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
			[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
		],
		listDate: [datesWithoutTime, datesWithoutTime],
		listTime: [['14:25:29.425', '14:25:29.425', '14:25:29.425'], ['14:25:29.425', '14:25:29.425', '14:25:29.425']],
		listTimestamp: [
			[
				new Date('2024-10-31T14:25:29.425Z'),
				new Date('2024-10-30T14:25:29.425Z'),
				new Date('2024-10-29T14:25:29.425Z'),
			],
			[
				new Date('2024-10-31T14:25:29.425Z'),
				new Date('2024-10-30T14:25:29.425Z'),
				new Date('2024-10-29T14:25:29.425Z'),
			],
		],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('nested 3d list type test', async () => {
	await sql.unsafe(`create table nested_3d_list_table (
        listInt integer[][][],
        listDouble double[][][],
        listBoolean boolean[][][],
        listBigint bigint[][][],
		listDate date[][][],
		listTime time[][][],
		listTimestamp timestamp[3][2][2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_3d_list_table values ($1, $2, $3, $4, $5, $6, $7);`, [
		[[[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]],
		[[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]], [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]]],
		[[[true, false, true], [true, false, true]], [[true, false, true], [true, false, true]]],
		[
			[
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
			],
			[
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
				[
					BigInt('9007199254740992') + BigInt(1),
					BigInt('9007199254740992') + BigInt(3),
					BigInt('9007199254740992') + BigInt(5),
				],
			],
		],
		[[dates, dates], [dates, dates]],
		[[dates, dates], [dates, dates]],
		[[dates, dates], [dates, dates]],
	]);

	const res = await sql.unsafe('select * from nested_3d_list_table;');

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		listInt: [[[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]],
		listDouble: [[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]], [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]]],
		listBoolean: [[[true, false, true], [true, false, true]], [[true, false, true], [true, false, true]]],
		listBigint: [
			[
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
			],
			[
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
				[BigInt('9007199254740993'), BigInt('9007199254740995'), BigInt('9007199254740997')],
			],
		],
		listDate: [[datesWithoutTime, datesWithoutTime], [datesWithoutTime, datesWithoutTime]],
		listTime: [
			[
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
			],
			[
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
				['14:25:29.425', '14:25:29.425', '14:25:29.425'],
			],
		],
		listTimestamp: [
			[
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
			],
			[
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
				[
					new Date('2024-10-31T14:25:29.425Z'),
					new Date('2024-10-30T14:25:29.425Z'),
					new Date('2024-10-29T14:25:29.425Z'),
				],
			],
		],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

// sql template
test('sql template types test', async () => {
	await sql`
		create table sql_template_table (
			smallint_ smallint,
		    integer_ integer,
			bigint_ bigint,
		    double_ double,
		    varchar_ varchar,
			boolean_ boolean,
			time_ time,
			date_ date,
			timestamp_ timestamp,
			json_ json,
		    arrayInt integer[3],
		    listInt integer[],
			arrayBigint bigint[1],
			listBigint bigint[],
			arrayBoolean boolean[3],
			listBoolean boolean[],
			arrayDouble double[3],
			listDouble double[],
			arrayJson json[1],
			listJson json[],
			arrayVarchar varchar[3],
			listVarchar varchar[],
			arrayTime time[3],
			listTime time[],
			arrayDate date[3],
			listDate date[],
			arrayTimestamp timestamp[3],
			listTimestamp timestamp[]
			);
	`;

	const date = new Date('2024-10-31T14:25:29.425Z');
	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];

	await sql`
		insert into sql_template_table values (
			${1}, ${10}, ${BigInt('9007199254740992') + BigInt(1)}, 
			${20.4}, ${'qwerty'}, ${true}, ${date}, ${date}, ${date}, 
			${{
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	}}, 
			${[1, 2, 3]}, ${[1, 2, 3, 4, 5]},
			${[BigInt('9007199254740992') + BigInt(1)]},
			${[BigInt('9007199254740992') + BigInt(1), BigInt('9007199254740992') + BigInt(3)]},
			${[true, false, true]},
			${[true, false]},
			${[3.4, 52.6, 3.5]},
			${[3.4, 52.6, 3.5]},
			${[{
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	}]},
			${[{
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	}]},
			['hel,lo', 'world', '!'],
			['hel,lo', 'world!'],
			${dates},
			${dates},
			${dates},
			${dates},
			${dates},
			${dates}
			);
	`;

	const res = await sql`select * from ${sql.identifier('sql_template_table')};`;

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);

	const datesWithoutTime = [...dates];
	for (const date of datesWithoutTime) date.setUTCHours(0, 0, 0, 0);

	const expectedRes = {
		smallint_: 1,
		integer_: 10,
		bigint_: BigInt('9007199254740993'),
		double_: 20.4,
		varchar_: 'qwerty',
		boolean_: true,
		time_: '14:25:29.425',
		date_: dateWithoutTime,
		timestamp_: date,
		json_: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		arrayInt: [1, 2, 3],
		listInt: [1, 2, 3, 4, 5],
		arrayBigint: [BigInt('9007199254740992') + BigInt(1)],
		listBigint: [BigInt('9007199254740992') + BigInt(1), BigInt('9007199254740992') + BigInt(3)],
		arrayBoolean: [true, false, true],
		listBoolean: [true, false],
		arrayDouble: [3.4, 52.6, 3.5],
		listDouble: [3.4, 52.6, 3.5],
		arrayJson: [{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}],
		listJson: [{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}],
		arrayVarchar: ['hel,lo', 'world', '!'],
		listVarchar: ['hel,lo', 'world!'],
		arrayTime: ['14:25:29.425', '14:25:29.425', '14:25:29.425'],
		arrayDate: datesWithoutTime,
		arrayTimestamp: [
			new Date('2024-10-31T14:25:29.425Z'),
			new Date('2024-10-30T14:25:29.425Z'),
			new Date('2024-10-29T14:25:29.425Z'),
		],
		listTime: ['14:25:29.425', '14:25:29.425', '14:25:29.425'],
		listDate: datesWithoutTime,
		listTimestamp: [
			new Date('2024-10-31T14:25:29.425Z'),
			new Date('2024-10-30T14:25:29.425Z'),
			new Date('2024-10-29T14:25:29.425Z'),
		],
	};
	expect(res[0]).toStrictEqual(expectedRes);
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

test('logger test', async () => {
	const loggerQuery = 'select $1;';
	const loggerParams = [1];
	const loggerText = `Query: select $1; -- params: [1]`;

	// metadata example:
	// { columnCount: 1, returnType: 3, rowsChanged: 0, statementType: 1 }
	const logger = {
		logQuery: (query: string, params: unknown[], metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
			expect(Object.keys(metadata)).toStrictEqual(['columnCount', 'returnType', 'rowsChanged', 'statementType']);
		},
	};

	let loggerSql: SQL;
	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});

	// case 0
	loggerSql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write', logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write', logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write', logger: false });
	await loggerSql`select ${1};`;

	consoleMock.mockRestore();
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
