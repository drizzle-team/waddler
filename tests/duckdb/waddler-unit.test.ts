import { beforeAll, expect, test } from 'vitest';
import { waddler } from '../../src/duckdb/driver.ts';

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	sql = waddler({ url: ':memory:', max: 10, accessMode: 'read_write' });
});

// toSQL
test('base test', () => {
	const res = sql`select 1;`.toSQL();

	expect(res).toStrictEqual({ query: `select 1;`, params: [] });
});

test('base test with number param', () => {
	const res = sql`select ${1};`.toSQL();

	expect(res).toStrictEqual({ query: `select $1;`, params: [1] });
});

test('base test with bigint param', () => {
	const res = sql`select ${BigInt(10)};`.toSQL();

	expect(res).toStrictEqual({ query: `select $1;`, params: [10n] });
});

test('base test with string param', () => {
	const res = sql`select ${'hello world.'};`.toSQL();

	expect(res).toStrictEqual({ query: `select $1;`, params: ['hello world.'] });
});

test('base test with boolean param', () => {
	const res = sql`select ${true};`.toSQL();

	expect(res).toStrictEqual({ query: `select $1;`, params: [true] });
});

test('base test with Date param', () => {
	const res = sql`select ${new Date('10.04.2025')};`.toSQL();

	expect(res).toStrictEqual({ query: `select $1;`, params: [new Date('10.04.2025')] });
});

test('base test with null param', () => {
	const res = sql`select ${null};`.toSQL();

	expect(res).toStrictEqual({ query: `select $1;`, params: [null] });
});

// errors
test('base test with undefined param. error', () => {
	// @ts-ignore
	expect(() => sql`select ${undefined};`.toSQL())
		.toThrowError("you can't specify undefined as parameter");
});

test('base test with symbol param. error', () => {
	// @ts-ignore
	expect(() => sql`select ${Symbol('fooo')};`.toSQL())
		.toThrowError("you can't specify symbol as parameter");
});

test('base test with function param. error', () => {
	// @ts-ignore
	expect(() => sql`select ${() => {}};`.toSQL())
		.toThrowError("you can't specify function as parameter");
});

// identifier ----------------------------------------------------------------------------------
test('sql.identifier test. string parameter', () => {
	const res = sql`select ${sql.identifier('name')} from users;`.toSQL();

	expect(res).toStrictEqual({ query: `select "name" from users;`, params: [] });
});

test('sql.identifier test. string[] parameter', () => {
	const res = sql`select ${sql.identifier(['name', 'email', 'phone'])} from users;`.toSQL();

	expect(res).toStrictEqual({ query: `select "name", "email", "phone" from users;`, params: [] });
});

test('sql.identifier test. object parameter', () => {
	const res = sql`select * from ${sql.identifier({ schema: 'public', table: 'users' })};`.toSQL();

	expect(res).toStrictEqual({ query: `select * from "public"."users";`, params: [] });
});

test('sql.identifier test. object[] parameter', () => {
	const res = sql`select ${
		sql.identifier([
			{ schema: 'public', table: 'users', column: 'name' },
			{ schema: 'public', table: 'users', column: 'email' },
		])
	} from users;`.toSQL();

	expect(res).toStrictEqual({
		query: `select "public"."users"."name", "public"."users"."email" from users;`,
		params: [],
	});
});

test('sql.identifier test. object[] parameter', () => {
	const res = sql`select ${
		sql.identifier([
			{ schema: 'public', table: 'users', column: 'name', as: 'user_name' },
			{ schema: 'public', table: 'users', column: 'email', as: 'user_email' },
		])
	} from users;`.toSQL();

	expect(res).toStrictEqual({
		query: `select "public"."users"."name" as "user_name", "public"."users"."email" as "user_email" from users;`,
		params: [],
	});
});

// errors
test('sql.identifier test. undefined | number | bigint | boolean | symbol | function | null as parameter. error', () => {
	const paramList = [undefined, 1, BigInt(10), true, Symbol('fooo'), () => {}];
	for (const param of paramList) {
		expect(
			// @ts-ignore
			() => sql`select ${sql.identifier(param)} from users;`.toSQL(),
		).toThrowError(`you can't specify ${typeof param} as parameter for sql.identifier.`);
	}

	expect(
		// @ts-ignore
		() => sql`select ${sql.identifier(null)} from users;`.toSQL(),
	).toThrowError(`you can't specify null as parameter for sql.identifier.`);
});

test('sql.identifier test. array of undefined | number | bigint | boolean | symbol | function | null | array as parameter. error', () => {
	const paramList = [
		['name', undefined],
		['name', 1],
		['name', BigInt(10)],
		['name', true],
		['name', Symbol('foo')],
		['name', () => {}],
	];
	for (const param of paramList) {
		expect(
			// @ts-ignore
			() => sql`select ${sql.identifier(param)} from users;`.toSQL(),
		).toThrowError(
			`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
		);
	}

	expect(
		// @ts-ignore
		() => sql`select ${sql.identifier([null])} from users;`.toSQL(),
	).toThrowError(
		`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
	);

	expect(
		// @ts-ignore
		() => sql`select ${sql.identifier(['name', []])} from users;`.toSQL(),
	).toThrowError(`you can't specify array of arrays as parameter for sql.identifier.`);
});

test("sql.identifier test. 'empty array' error", () => {
	expect(
		() => sql`select ${sql.identifier([])} from users;`.toSQL(),
	).toThrowError(`you can't specify empty array as parameter for sql.identifier.`);
});

test("sql.identifier test. 'undefined in parameters' error with object parameter", () => {
	expect(
		() => sql`select ${sql.identifier({ schema: undefined })}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`you can't specify undefined parameters. maybe you want to omit it?`);
});

test("sql.identifier test. 'no parameters' error with object parameter", () => {
	expect(
		() => sql`select ${sql.identifier({})}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`you need to specify at least one parameter.`);
});

test("sql.identifier test. 'only schema and column' error with object parameter", () => {
	expect(
		() =>
			sql`select ${sql.identifier({ schema: 'public', column: 'name' })}, "email", "phone" from "public"."users";`
				.toSQL(),
	).toThrowError(`you can't specify only "schema" and "column" properties, you need also specify "table".`);
});

test("sql.identifier test. 'only as' error with object parameter", () => {
	expect(
		() => sql`select ${sql.identifier({ as: 'user_name' })}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`you can't specify only "as" property.`);
});

test("sql.identifier test. 'column or table should be specified with as' error with object parameter", () => {
	expect(
		() =>
			sql`select ${sql.identifier({ schema: 'public', as: 'user_name' })}, "email", "phone" from "public"."users";`
				.toSQL(),
	).toThrowError(`you have to specify "column" or "table" property along with "as".`);
});

test("sql.identifier test. wrong types in object's properties 'schema', 'table', 'column', 'as'. error with object parameter", () => {
	expect(
		() =>
			sql`select ${
				// @ts-ignore
				sql.identifier({
					schema: 'public',
					table: 'users',
					column: 'name',
					as: 4,
				})}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

	expect(
		// @ts-ignore
		() =>
			sql`select ${
				// @ts-ignore
				sql.identifier({
					schema: 'public',
					table: 'users',
					column: 4,
					as: 'user_name',
				})}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

	expect(
		// @ts-ignore
		() =>
			sql`select ${
				// @ts-ignore
				sql.identifier({
					schema: 'public',
					table: 4,
					column: 'name',
					as: 'user_name',
				})}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

	expect(
		// @ts-ignore
		() =>
			sql`select ${
				// @ts-ignore
				sql.identifier({
					schema: 4,
					table: 'users',
					column: 'name',
					as: 'user_name',
				})}, "email", "phone" from "public"."users";`.toSQL(),
	).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);
});

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

test('sql.values array type test', async () => {
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

// raw ----------------------------------------------------------------------------------
test('sql.raw test. number | boolean | bigint | string as parameter.', () => {
	let res = sql`select ${sql.raw(1)};`.toSQL();
	expect(res).toStrictEqual({ query: 'select 1;', params: [] });

	res = sql`select ${sql.raw(true)};`.toSQL();
	expect(res).toStrictEqual({ query: 'select true;', params: [] });

	res = sql`select ${sql.raw(BigInt(10))};`.toSQL();
	expect(res).toStrictEqual({ query: 'select 10;', params: [] });

	res = sql`select ${sql.raw('* from users')};`.toSQL();
	expect(res).toStrictEqual({ query: 'select * from users;', params: [] });
});

// errors
test('sql.raw test. array | object | null | undefined | symbol | function as parameter. error.', () => {
	let paramList = [[], {}, null];
	for (const param of paramList) {
		expect(
			// @ts-ignore
			() => sql`select ${sql.raw(param)};`.toSQL(),
		).toThrowError(`you can't specify array, object or null as parameter for sql.raw.`);
	}

	expect(
		// @ts-ignore
		() => sql`select ${sql.raw(undefined)};`.toSQL(),
	).toThrowError(`you can't specify undefined as parameter for sql.raw, maybe you mean using sql.default?`);

	paramList = [Symbol('fooo'), () => {}];
	for (const param of paramList) {
		expect(
			// @ts-ignore
			() => sql`select ${sql.raw(param)};`.toSQL(),
		).toThrowError(`you can't specify ${typeof param} as parameter for sql.raw.`);
	}
});

// default ------------------------------------------------------------------------------
test('sql.default test using with sql.values.', () => {
	const res = sql`insert into users (id, name) values ${sql.values([[sql.default, 'name1']])};`.toSQL();
	expect(res).toStrictEqual({ query: "insert into users (id, name) values (default, 'name1');", params: [] });
});

test('sql.default test using with sql`${}` as parameter.', () => {
	const res = sql`insert into users (id, name) values (${sql.default}, 'name1');`.toSQL();
	expect(res).toStrictEqual({ query: "insert into users (id, name) values (default, 'name1');", params: [] });
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

// sql.append
test('sql.append test.', async () => {
	const query = sql<undefined>`select * from users where id = ${1}`;

	query.append(sql` or id = ${3}`);
	query.append(sql` or id = ${4};`);

	const res = query.toSQL();
	expect(res).toStrictEqual({
		query: 'select * from users where id = $1 or id = $2 or id = $3;',
		params: [1, 3, 4],
	});
});
