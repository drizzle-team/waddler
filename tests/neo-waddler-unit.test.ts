import { beforeAll, expect, test } from 'vitest';
import { waddler } from '../src/neo.ts';
import type { SQL } from '../src/neo.ts';

let sql: SQL;
beforeAll(async () => {
	sql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write' });
});

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
			'qwerty',
			true,
			date,
			date,
			date,
			{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
			[1, 2, 3],
			[1, 2, 3, 4, 5],
		],
		{ rowMode: 'default' },
	);

	let res = await sql.unsafe(`select * from all_types;`);

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);
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
		{ rowMode: 'default' },
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
		{ rowMode: 'default' },
	);

	const expectedMap = new Map([
		[new Map([['a', 42], ['b', -32]]), 42.001],
		[new Map([['a1', 42], ['b1', -32]]), -32.1],
	]);
	res = await sql.unsafe(`select * from map_table;`);

	expect(res[0]).toStrictEqual({ map_: expectedMap });

	// TODO: add tests for select when the columns are of type: map, struct, union, ...
});

test('array type test', async () => {
	await sql.unsafe(`create table array_table (
        arrayInt integer[3],
        arrayDouble double[3],
        arrayBoolean boolean[3],
        arrayBigint bigint[3],
		arrayVarchar varchar[3],
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
	await sql.unsafe(`insert into array_table values ($1, $2, $3, $4, $5, $6, $7, $8, $9);`, [
		[1, 2, 3],
		[1.5, 2.6, 3.9],
		[true, false, true],
		[
			BigInt('9007199254740992') + BigInt(1),
			BigInt('9007199254740992') + BigInt(3),
			BigInt('9007199254740992') + BigInt(5),
		],
		['hello', 'world', '!'],
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
		arrayVarchar: ['hello', 'world', '!'],
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
		arrayVarchar varchar[3][2],
		arrayDate date[3][2],
		arrayTime time[3][2],
		arrayTimestamp timestamp[3][2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_array_table values ($1, $2, $3, $4, $5, $6, $7, $8);`, [
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
		[['hello', 'world', '!'], ['hello', 'world', '!']],
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
		arrayVarchar: [['hello', 'world', '!'], ['hello', 'world', '!']],
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
		arrayVarchar varchar[3][2][2],
		arrayDate date[3][2][2],
		arrayTime time[3][2][2],
		arrayTimestamp timestamp[3][2][2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_3d_array_table values ($1, $2, $3, $4, $5, $6, $7, $8);`, [
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
		[
			[
				['hello', 'world', '!'],
				['hello', 'world', '!'],
			],
			[
				['hello', 'world', '!'],
				['hello', 'world', '!'],
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
		arrayVarchar: [
			[
				['hello', 'world', '!'],
				['hello', 'world', '!'],
			],
			[
				['hello', 'world', '!'],
				['hello', 'world', '!'],
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
		listVarchar varchar[],
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
	await sql.unsafe(`insert into list_table values ($1, $2, $3, $4, $5, $6, $7, $8, $9);`, [
		[1, 2, 3, 1234, 34],
		[1.5, 2.6, 3.9, 100.345],
		[true, false],
		[
			BigInt('9007199254740992') + BigInt(1),
			BigInt('9007199254740992') + BigInt(3),
			BigInt('9007199254740992') + BigInt(5),
		],
		['hello', 'world', '!'],
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
		listVarchar: ['hello', 'world', '!'],
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
        listInt integer[3][2],
        listDouble double[3][2],
        listBoolean boolean[3][2],
        listBigint bigint[3][2],
		listVarchar varchar[3][2],
		listDate date[3][2],
		listTime time[3][2],
		listTimestamp timestamp[3][2]
    );`);

	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	await sql.unsafe(`insert into nested_list_table values ($1, $2, $3, $4, $5, $6, $7, $8);`, [
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
		[['hello', 'world', '!'], ['hello', 'world', '!']],
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
		listVarchar: [['hello', 'world', '!'], ['hello', 'world', '!']],
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
