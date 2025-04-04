import type Docker from 'dockerode';
import type { Client as ClientT } from 'pg';
import pg from 'pg';
import { createAllDataTypesTable, defaultValue, dropAllDataTypesTable, tests } from 'tests/pg-core.ts';
import { createPgDockerDB } from 'tests/utils.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { waddler } from '../../src/node-postgres/driver.ts';
import { queryStream } from '../../src/node-postgres/pg-query-stream.ts';
import type { SQL } from '../../src/sql.ts';

const { Client, Pool } = pg;

let pgContainer: Docker.Container;
let pgClient: ClientT;
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
			pgClient = new Client(dockerPayload.connectionParams);
			await pgClient.connect();
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
	const client = new Client({ ...pgConnectionParams });
	await client.connect();
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	const sql12 = waddler({ client });
	await sql12`select 12;`;
	await client.end();

	const pool = new Pool({ ...pgConnectionParams });
	const sql2 = waddler({ client: pool });
	await sql2`select 2;`;

	const sql22 = waddler({ client: pool });
	await sql22`select 22;`;
	await pool.end();
});

// UNSAFE-------------------------------------------------------------------
// test('all types in sql.unsafe test', async () => {
// 	await dropAllDataTypesTable(sql);
// 	await createAllDataTypesTable(sql);

// 	const date = new Date('2024-10-31T14:25:29.425');
// 	const values = [
// 		1,
// 		10,
// 		BigInt('9007199254740992') + BigInt(1),
// 		1,
// 		10,
// 		BigInt('9007199254740992') + BigInt(1),
// 		true,
// 		'qwerty',
// 		'qwerty',
// 		'qwerty',
// 		'20.4',
// 		20.4,
// 		20.4,
// 		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
// 		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
// 		'14:25:29.425',
// 		date,
// 		'2024-10-31',
// 		'1 day',
// 		'(1,2)',
// 		'{1,2,3}',
// 		`no,'"\`rm`,
// 		'550e8400-e29b-41d4-a716-446655440000',
// 		// sql.default,
// 	];

// 	await sql.unsafe(
// 		`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, default);`,
// 		values,
// 		{ rowMode: 'object' },
// 	);

// 	const res = await sql.unsafe(`select * from all_data_types;`);

// 	const dateWithoutTime = new Date(date);
// 	dateWithoutTime.setUTCHours(0, 0, 0, 0);
// 	const expectedRes = {
// 		integer: 1,
// 		smallint: 10,
// 		bigint: String(BigInt('9007199254740992') + BigInt(1)),
// 		serial: 1,
// 		smallserial: 10,
// 		bigserial: String(BigInt('9007199254740992') + BigInt(1)),
// 		boolean: true,
// 		text: 'qwerty',
// 		varchar: 'qwerty',
// 		char: 'qwerty',
// 		numeric: '20.4',
// 		real: 20.4,
// 		double_precision: 20.4,
// 		json: {
// 			name: 'alex',
// 			age: 26,
// 			bookIds: [1, 2, 3],
// 			vacationRate: 2.5,
// 			aliases: ['sasha', 'sanya'],
// 			isMarried: true,
// 		},
// 		jsonb: {
// 			name: 'alex',
// 			age: 26,
// 			bookIds: [1, 2, 3],
// 			vacationRate: 2.5,
// 			aliases: ['sasha', 'sanya'],
// 			isMarried: true,
// 		},
// 		time: '14:25:29.425',
// 		timestamp_date: date,
// 		date: new Date('2024-10-30T22:00:00.000Z'),
// 		interval: '1 day',
// 		point: { x: 1, y: 2 }, // [1, 2]
// 		line: '{1,2,3}', // [1, 2, 3]
// 		mood_enum: `no,'"\`rm`,
// 		uuid: '550e8400-e29b-41d4-a716-446655440000',
// 		default: 3,
// 	};

// 	expect(res[0]).toStrictEqual(expectedRes);

// 	// same as select query as above but with rowMode: "array"
// 	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
// 	expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
// });

// sql.values
// ALL TYPES-------------------------------------------------------------------

test.only('all types in sql.unsafe test', async () => {
	await tests['all_types_in_sql.unsafe'].test(sql);
});

test('all types in sql.values, sql.raw in select test', async () => {
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
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
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
		date,
		new Date('2024-10-30T22:00:00.000Z'),
		'1 day',
		{ x: 1, y: 2 }, // [1, 2],
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

test('all array types in sql.values test', async () => {
	await sql.unsafe(`DO $$ BEGIN
			 CREATE TYPE "public"."mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');
			EXCEPTION
			 WHEN duplicate_object THEN null;
			END $$;
		`);

	const date = new Date('2024-10-31T14:25:29.425Z');

	await sql.unsafe(`CREATE TABLE IF NOT EXISTS "public"."all_array_data_types" (
		"integer_array" integer[],
		"smallint_array" smallint[],
		"bigint_array" bigint[],
		"boolean_array" boolean[],
		"text_array" text[],
		"varchar_array" varchar(256)[],
		"char_array" char(6)[],
		"numeric_array" numeric[],
		"real_array" real[],
		"double_precision_array" double precision[],
		"json_array" json[],
		"jsonb_array" jsonb[],
		"time_array" time[],
		"timestamp_date_array" timestamptz[],
		"date_array" date[],
		"interval_array" interval[],
		"point_array" point[],
		"line_array" line[],
		"mood_enum_array" "public"."mood_enum"[],
		uuid_array "uuid"[]
	);`);

	const allArrayDataTypesValues = [
		[1],
		[10],
		[String(BigInt('9007199254740992') + BigInt(1))],
		[true],
		['qwerty'],
		['qwerty'],
		['qwerty'],
		[20.4],
		[20.4],
		[20.4],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		['14:25:29.425'],
		[date],
		['2024-10-31'],
		['1 days'],
		['(1,2)'],
		['{1.1,2,3}', '{4.4,5,6}'],
		['ok', 'happy', `no,'"\`rm`],
		['550e8400-e29b-41d4-a716-446655440000'],
	];

	const expectedRes1 = [
		[1],
		[10],
		[String(BigInt('9007199254740992') + BigInt(1))],
		[true],
		['qwerty'],
		['qwerty'],
		['qwerty'],
		[20.4],
		[20.4],
		[20.4],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		[{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true }],
		['14:25:29.425'],
		[date],
		[new Date('2024-10-30T22:00:00.000Z')],
		`{"1 day"}`, // ['1 day'],
		[{ x: 1, y: 2 }], // [[1, 2]],
		'{"{1.1,2,3}","{4.4,5,6}"}', // [[1.1, 2, 3], [4.4, 5, 6]], // ['{1.1,2,3}', '{4.4,5,6}'],
		'{ok,happy,"no,\'\\"`rm"}', // ['ok', 'happy', `no,'"\`rm`],
		['550e8400-e29b-41d4-a716-446655440000'],
	];

	await sql`insert into ${sql.identifier('all_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes1);
});

test('all nd-array types in sql.values test', async () => {
	await sql.unsafe(`DO $$ BEGIN
			 CREATE TYPE "public"."mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');
			EXCEPTION
			 WHEN duplicate_object THEN null;
			END $$;
		`);

	const date = new Date('2024-10-31T14:25:29.425Z');

	await sql.unsafe(`CREATE TABLE IF NOT EXISTS "public"."all_nd_array_data_types" (
		"integer_array_2d" integer[][],
		"json_array_2d" json[][],
		"jsonb_array_2d" jsonb[][],
		"time_array_2d" time[][],
		"timestamp_date_array_2d" timestamptz[][],
		"date_array_2d" date[][],
		"interval_array_2d" interval[][],
		"point_array_2d" point[][],
		"line_array_2d" line[][],
		"mood_enum_array_2d" "public"."mood_enum"[][],
		uuid_array_2d "uuid"[][]
	);`);

	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};
	const allArrayDataTypesValues = [
		[[1, 2], [2, 3]],
		[[json], [json]],
		[[json], [json]],
		[['14:25:29.425'], ['14:25:29.425']],
		[[date], [date]],
		[['2024-10-31'], ['2024-10-31']],
		[['1 days'], ['1 days']],
		[['(1,2)'], ['(1,2)']],
		[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']],
		[['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
	];

	const expectedRes1 = [
		[[1, 2], [2, 3]],
		[[json], [json]],
		[[json], [json]],
		[['14:25:29.425'], ['14:25:29.425']],
		[[date], [date]],
		[[new Date('2024-10-30T22:00:00.000Z')], [new Date('2024-10-30T22:00:00.000Z')]],
		`{{"1 day"},{"1 day"}}`, // [['1 days'], ['1 days']]
		[[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]], // [[[1, 2]], [[1, 2]]],
		'{{"{1.1,2,3}","{4.4,5,6}"},{"{1.1,2,3}","{4.4,5,6}"}}', // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]],
		'{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}', // [['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
	];

	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]).toStrictEqual(expectedRes1);
});

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
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
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
		timestamp_date: date,
		date: new Date('2024-10-30T22:00:00.000Z'),
		interval: '1 day',
		point: { x: 1, y: 2 }, // [1, 2]
		line: '{1,2,3}', // [1, 2, 3]
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		default: 3,
	};

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const client = new Client({ ...pgConnectionParams });
	await client.connect();
	const sqlClient = waddler({ client, extensions: [queryStream()] });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(row).toStrictEqual(expectedRes);
	}

	await client.end();

	const pool = new Pool({ ...pgConnectionParams });
	const sqlPool = waddler({ client: pool, extensions: [queryStream()] });
	const streamPool = sqlPool`select * from all_data_types;`.stream();
	for await (const row of streamPool) {
		expect(row).toStrictEqual(expectedRes);
	}

	await pool.end();
});
