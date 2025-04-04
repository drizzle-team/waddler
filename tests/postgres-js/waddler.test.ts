import type Docker from 'dockerode';
import type { Sql } from 'postgres';
import postgres from 'postgres';
import {
	// createAllArrayDataTypesTable,
	createAllDataTypesTable,
	// createAllNdarrayDataTypesTable,
	defaultValue,
	dropAllDataTypesTable,
} from 'tests/pg-core.ts';
import { createPgDockerDB } from 'tests/utils.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { waddler } from '../../src/postgres-js/index.ts';
import type { SQL } from '../../src/sql.ts';

let pgContainer: Docker.Container;
let pgClient: Sql;
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
			pgClient = postgres(dockerPayload.connectionParams);
			await pgClient.unsafe(`select 1;`);
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

test('connection test', async () => {
	const pool = postgres({ ...pgConnectionParams });
	const sql1 = waddler({ client: pool });
	await sql1`select 1;`;

	const sql11 = waddler(pool);
	await sql11`select 11;`;

	await pool.end();

	const sql2 = waddler({ connection: pgConnectionParams });
	await sql2`select 2;`;

	const url =
		`postgres://${pgConnectionParams.user}:${pgConnectionParams.password}@${pgConnectionParams.host}:${pgConnectionParams.port}/${pgConnectionParams.database}`;
	const sql21 = waddler({ connection: url });
	await sql21`select 21;`;

	const sql22 = waddler(url);
	await sql22`select 22;`;

	const sql23 = waddler({ connection: { url } });
	await sql23`select 23;`;
});

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');

	const values = [
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
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		'14:25:29.425',
		new Date('2024-10-31T14:25:29.425Z'),
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		// sql.default,
	];

	await sql.unsafe(
		`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, default);`,
		values,
		{ rowMode: 'object' },
	);

	const res = await sql.unsafe(`select * from all_data_types;`);

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);
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
		timestamp_date: new Date('2024-10-31T12:25:29.425Z'),
		date: new Date('2024-10-31T00:00:00.000Z'),
		interval: '1 day',
		point: '(1,2)', // [1, 2]
		line: '{1,2,3}', // [1, 2, 3]
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		default: 3,
	};

	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
	expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values, sql.raw in select test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

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
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		'14:25:29.425',
		new Date('2024-10-31T14:25:29.425Z'),
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		sql.default,
	];

	const expectedRes = [
		1,
		10,
		String(BigInt('9007199254740992') + BigInt(1)),
		1,
		10,
		String(BigInt('9007199254740992') + BigInt(1)),
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
		new Date('2024-10-31T12:25:29.425Z'),
		new Date('2024-10-31T00:00:00.000Z'),
		'1 day',
		'(1,2)', // [1, 2],
		'{1,2,3}', // [1, 2, 3],
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		3,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes);

	// sql.raw case
	const asColumn: string = 'case_column';
	const asClause = asColumn === '' ? sql.raw('') : sql.raw(` as ${asColumn}`);

	const res1Query = sql`select ${
		sql.raw(`case when "default" = ${defaultValue} then 'column=default' else 'column!=default' end`)
	}${asClause} from all_data_types;`;

	const { query: res1Sql, params: res1Params } = res1Query.toSQL();
	expect(res1Sql).toEqual(
		`select case when "default" = 3 then 'column=default' else 'column!=default' end as case_column from all_data_types;`,
	);
	expect(res1Params.length).toEqual(0);

	const res1 = await res1Query;
	expect(res1[0]!['case_column']).toEqual('column=default');
});

// TODO: fix tests for arrays

// test.only('all array types in sql.values test', async () => {
// 	await createAllArrayDataTypesTable(sql);

// 	const date = new Date('2024-10-31T14:25:29.425Z');

// 	const allArrayDataTypesValues = [
// 		[1],
// 		[10],
// 		[String(BigInt('9007199254740992') + BigInt(1))],
// 		[true],
// 		['qwerty'],
// 		['qwerty'],
// 		['qwerty'],
// 		[20.4],
// 		[20.4],
// 		[20.4],
// 		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
// 		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
// 		['14:25:29.425'],
// 		[date],
// 		['2024-10-31'],
// 		['1 days'],
// 		['(1,2)'],
// 		['{1.1,2,3}', '{4.4,5,6}'],
// 		['ok', 'happy', `no,'"\`rm`],
// 		['550e8400-e29b-41d4-a716-446655440000'],
// 	];

// 	const expectedRes = [
// 		[1],
// 		[10],
// 		[String(BigInt('9007199254740992') + BigInt(1))],
// 		[true],
// 		['qwerty'],
// 		['qwerty'],
// 		['qwerty'],
// 		[20.4],
// 		[20.4],
// 		[20.4],
// 		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
// 		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
// 		['14:25:29.425'],
// 		[date],
// 		[new Date('2024-10-30T22:00:00.000Z')],
// 		`{"1 day"}`, // ['1 day'],
// 		[{ x: 1, y: 2 }], // [[1, 2]],
// 		'{"{1.1,2,3}","{4.4,5,6}"}', // [[1.1, 2, 3], [4.4, 5, 6]], // ['{1.1,2,3}', '{4.4,5,6}'],
// 		'{ok,happy,"no,\'\\"`rm"}', // ['ok', 'happy', `no,'"\`rm`],
// 		['550e8400-e29b-41d4-a716-446655440000'],
// 	];

// 	await sql`insert into ${sql.identifier('all_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

// 	const res = await sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

// 	expect(res[0]).toStrictEqual(expectedRes);
// });

// test.only('all nd-array types in sql.values test', async () => {
// 	await createAllNdarrayDataTypesTable(sql);

// 	const date = new Date('2024-10-31T14:25:29.425Z');

// 	const json = {
// 		name: 'alex',
// 		age: 26,
// 		bookIds: [1, 2, 3],
// 		vacationRate: 2.5,
// 		aliases: ['sasha', 'sanya'],
// 		isMarried: true,
// 	};
// 	const allArrayDataTypesValues = [
// 		[[1, 2], [2, 3]],
// 		[[json], [json]],
// 		[[json], [json]],
// 		[['14:25:29.425'], ['14:25:29.425']],
// 		[[date], [date]],
// 		[['2024-10-31'], ['2024-10-31']],
// 		[['1 days'], ['1 days']],
// 		[['(1,2)'], ['(1,2)']],
// 		[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']],
// 		[['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
// 		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
// 	];

// 	const expectedRes1 = [
// 		[[1, 2], [2, 3]],
// 		[[json], [json]],
// 		[[json], [json]],
// 		[['14:25:29.425'], ['14:25:29.425']],
// 		[[date], [date]],
// 		[[new Date('2024-10-30T22:00:00.000Z')], [new Date('2024-10-30T22:00:00.000Z')]],
// 		`{{"1 day"},{"1 day"}}`, // [['1 days'], ['1 days']]
// 		[[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]], // [[[1, 2]], [[1, 2]]],
// 		'{{"{1.1,2,3}","{4.4,5,6}"},{"{1.1,2,3}","{4.4,5,6}"}}', // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]],
// 		'{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}', // [['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
// 		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
// 	];

// 	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

// 	const res = await sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

// 	expect(res[0]).toStrictEqual(expectedRes1);
// });

// sql.stream
test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425Z');
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
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		'14:25:29.425',
		date,
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
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
		timestamp_date: new Date('2024-10-31T12:25:29.425Z'),
		date: new Date('2024-10-31T00:00:00.000Z'),
		interval: '1 day',
		point: '(1,2)', // [1, 2]
		line: '{1,2,3}', // [1, 2, 3]
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		default: 3,
	};

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const pool = postgres({ ...pgConnectionParams });
	const sqlClient = waddler({ client: pool });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(row).toStrictEqual(expectedRes);
	}

	await pool.end();
});
