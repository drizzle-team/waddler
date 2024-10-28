import { expect, test } from 'vitest';
import { waddler } from '../src';

const sql = waddler({ url: './db', max: 10, accessMode: 'read_write' });

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

	expect(res).toStrictEqual({ query: `select 10;`, params: [] });
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

test('base test with object or array param. error', () => {
	// @ts-ignore
	expect(() => sql`select ${({ a: 1 })};`.toSQL())
		.toThrowError("you can't specify array or object as parameter");

	// @ts-ignore
	expect(() => sql`select ${[1, 2, 3]};`.toSQL())
		.toThrowError("you can't specify array or object as parameter");
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
