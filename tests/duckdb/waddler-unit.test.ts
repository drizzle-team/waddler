import { commonTests } from 'tests/common/common.test.ts';
import { commonPgTests } from 'tests/pg-core';
import { beforeAll, beforeEach, expect, test } from 'vitest';
import type { SQL } from '../../src/duckdb';
import { waddler } from '../../src/duckdb';

let sql: SQL;
beforeAll(() => {
	sql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write' });
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

// values ----------------------------------------------------------------------------------
test('sql.values test. ', () => {
	const res = sql`insert into users (id, name, is_active) values ${
		sql.values([[1, 'Oleksii', false], [2, 'Alex', true]])
	};`.toSQL();
	expect(res).toStrictEqual({
		query: "insert into users (id, name, is_active) values (1, 'Oleksii', false), (2, 'Alex', true);",
		params: [],
	});
});

test('sql.values test. number, boolean, string, bigint, null, Date, SQLDefault as values', () => {
	const res = sql`insert into users (id, is_active, name, bigint_, null_) values ${
		sql.values([[1, true, 'Oleksii', BigInt(1), null, new Date('10.04.2025'), sql.default]])
	};`.toSQL();
	expect(res).toStrictEqual({
		query:
			"insert into users (id, is_active, name, bigint_, null_) values (1, true, 'Oleksii', 1, null, '2025-10-03T21:00:00.000Z', default);",
		params: [],
	});
});

test('sql.values array type test', () => {
	const dates = [
		new Date('2024-10-31T14:25:29.425Z'),
		new Date('2024-10-30T14:25:29.425Z'),
		new Date('2024-10-29T14:25:29.425Z'),
	];
	const query = sql`insert into array_table values ${
		sql.values([[
			[1, 2, 3],
			[1.5, 2.6, 3.9],
			[true, false, true],
			[
				BigInt('9007199254740992') + BigInt(1),
				BigInt('9007199254740992') + BigInt(3),
				BigInt('9007199254740992') + BigInt(5),
			],
			dates,
		]])
	};`;

	const expectedQuery = 'insert into array_table values ('
		+ '[1,2,3], [1.5,2.6,3.9], [true,false,true], [9007199254740993,9007199254740995,9007199254740997], '
		+ "['2024-10-31T14:25:29.425Z','2024-10-30T14:25:29.425Z','2024-10-29T14:25:29.425Z']);";

	expect(query.toSQL().query).toStrictEqual(expectedQuery);
});

// errors
test('sql.values test. undefined | string | number | object |bigint | boolean | symbol | function | null as parameter. error', () => {
	const paramList = [undefined, 'hello world', 1, {}, BigInt(10), true, Symbol('fooo'), () => {}];
	for (const param of paramList) {
		expect(
			// @ts-ignore
			() => sql`insert into users (id, name, is_active) values ${sql.values(param)};`.toSQL(),
		).toThrowError(`you can't specify ${typeof param} as parameter for sql.values.`);
	}

	expect(
		// @ts-ignore
		() => sql`insert into users (id, name, is_active) values ${sql.values(null)};`.toSQL(),
	).toThrowError(`you can't specify null as parameter for sql.values.`);
});

test("sql.values test. 'empty array' error", () => {
	expect(
		() => sql`insert into users (id, name, is_active) values ${sql.values([])};`.toSQL(),
	).toThrowError(`you can't specify empty array as parameter for sql.values.`);
});

test('sql.values test. array of null | undefined | object | number | bigint | boolean | function | symbol | string as parameter. error', () => {
	expect(
		// @ts-ignore
		() => sql`insert into users (id, name, is_active) values ${sql.values([null])};`.toSQL(),
	).toThrowError(`you can't specify array of null as parameter for sql.values.`);

	const valsList = [undefined, {}, 1, BigInt(10), true, () => {}, Symbol('fooo'), 'fooo'];
	for (const val of valsList) {
		expect(
			// @ts-ignore
			() => sql`insert into users (id, name, is_active) values ${sql.values([val])};`.toSQL(),
		).toThrowError(`you can't specify array of ${typeof val} as parameter for sql.values.`);
	}
});

test('sql.values test. array of empty array. error', () => {
	expect(
		// @ts-ignore
		() => sql`insert into users (id, name, is_active) values ${sql.values([[]])};`.toSQL(),
	).toThrowError(`array of values can't be empty.`);
});

test('sql.values test. array | object | undefined | symbol | function as value. error', () => {
	let valsList = [{}];

	for (const val of valsList) {
		expect(
			// @ts-ignore
			() => sql`insert into users (id, name, is_active) values ${sql.values([[val]])};`.toSQL(),
		).toThrowError(
			`value can't be object. you can't specify [ [ {...}, ...], ...] as parameter for sql.values.`,
		);
	}

	expect(
		// @ts-ignore
		() => sql`insert into users (id, name, is_active) values ${sql.values([[undefined]])};`.toSQL(),
	).toThrowError(`value can't be undefined, maybe you mean sql.default?`);

	valsList = [Symbol('fooo'), () => {}];
	for (const val of valsList) {
		expect(
			// @ts-ignore
			() => sql`insert into users (id, name, is_active) values ${sql.values([[val]])};`.toSQL(),
		).toThrowError(`you can't specify ${typeof val} as value.`);
	}
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
	const query = sql`
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
			['hel,lo', 'world', '!'],
			${dates},
			${dates},
			${dates},
			${dates},
			${dates},
			${dates}
			);
	`;

	await query;

	const res = await sql`select * from sql_template_table;`;

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
		arrayVarchar: '[hel,lo, world, !]',
		listVarchar: ['hel,lo', 'world', '!'],
		arrayTime: '[14:25:29.425, 14:25:29.425, 14:25:29.425]',
		arrayDate: '[2024-10-31, 2024-10-30, 2024-10-29]',
		arrayTimestamp: '[2024-10-31 14:25:29.425, 2024-10-30 14:25:29.425, 2024-10-29 14:25:29.425]',
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
