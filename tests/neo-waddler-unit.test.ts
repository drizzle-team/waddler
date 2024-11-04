import { beforeAll, expect, test } from 'vitest';
import { waddler } from '../src/neo.ts';
import type { SQL } from '../src/neo.ts';

let sql: SQL;
beforeAll(async () => {
	sql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write' });
});

// unsafe
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
			100n,
			20.4,
			'qwerty',
			true,
			date,
			date,
			date,
			{ name: 'alex', age: 26 },
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
		bigint_: 100n,
		double_: 20.4,
		varchar_: 'qwerty',
		boolean_: true,
		time_: '14:25:29.425',
		date_: dateWithoutTime,
		timestamp_: date,
		json_: { name: 'alex', age: 26 },
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
    );`);
	// arrayVarchar varchar[3],
	// arrayDate date[3],
	// arrayTime time[3],
	// arrayTimestamp timestamp[3]

	// const dates = [new Date('2024-10-31T14:25:29.425Z'), new Date('2024-10-30T14:25:29.425Z'), new Date('2024-10-29T14:25:29.425Z')];
	await sql.unsafe(`insert into array_table values ($1, $2, $3, $4);`, [
		[1, 2, 3],
		[1.5, 2.6, 3.9],
		[true, false, true],
		[100000, 20000, 300000],
	]);

	const res = await sql.unsafe('select * from array_table;');

	const expectedRes = {
		arrayInt: [1, 2, 3],
		arrayDouble: [1.5, 2.6, 3.9],
		arrayBoolean: [true, false, true],
		arrayBigint: [100000n, 20000n, 300000n],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('nested array type test', async () => {
	await sql.unsafe(`create table nested_array_table (
        arrayInt integer[3][2],
        arrayDouble double[3][2],
        arrayBoolean boolean[3][2],
        arrayBigint bigint[3][2],
    );`);
	// arrayVarchar varchar[3],
	// arrayDate date[3],
	// arrayTime time[3],
	// arrayTimestamp timestamp[3]

	// const dates = [new Date('2024-10-31T14:25:29.425Z'), new Date('2024-10-30T14:25:29.425Z'), new Date('2024-10-29T14:25:29.425Z')];
	await sql.unsafe(`insert into nested_array_table values ($1, $2, $3, $4);`, [
		[[1, 2, 3], [1, 2, 3]],
		[[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]],
		[[true, false, true], [true, false, true]],
		[[100000, 20000, 300000], [100000, 20000, 300000]],
	]);

	const res = await sql.unsafe('select * from nested_array_table;');

	console.log(res[0]);
	const expectedRes = {
		arrayInt: [[1, 2, 3], [1, 2, 3]],
		arrayDouble: [[1.5, 2.6, 3.9], [1.5, 2.6, 3.9]],
		arrayBoolean: [[true, false, true], [true, false, true]],
		arrayBigint: [[100000n, 20000n, 300000n], [100000n, 20000n, 300000n]],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});

test('list type test', async () => {
	await sql.unsafe(`create table list_table (
        listInt integer[],
        listDouble double[],
        listBoolean boolean[],
        listBigint bigint[],
    );`);
	// listVarchar varchar[],
	// arrayDate date[],
	// arrayTime time[],
	// arrayTimestamp timestamp[]

	// const dates = [new Date('2024-10-31T14:25:29.425Z'), new Date('2024-10-30T14:25:29.425Z'), new Date('2024-10-29T14:25:29.425Z')];
	await sql.unsafe(`insert into list_table values ($1, $2, $3, $4);`, [
		[1, 2, 3, 1234, 34],
		[1.5, 2.6, 3.9, 100.345],
		[true, false],
		[100000, 20000, 300000, 400000000],
	]);

	const res = await sql.unsafe('select * from list_table;');
	const expectedRes = {
		listInt: [1, 2, 3, 1234, 34],
		listDouble: [1.5, 2.6, 3.9, 100.345],
		listBoolean: [true, false],
		listBigint: [100000n, 20000n, 300000n, 400000000n],
	};

	expect(res[0]).toStrictEqual(expectedRes);
});
