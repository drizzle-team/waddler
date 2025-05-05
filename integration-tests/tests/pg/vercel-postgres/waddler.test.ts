import 'dotenv/config';
import type { VercelClient } from '@vercel/postgres';
import { createClient, createPool } from '@vercel/postgres';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import type { SQL } from 'waddler';
import { queryStream } from 'waddler/extensions/pg-query-stream';
import { waddler } from 'waddler/vercel-postgres';
import { commonTests } from '../../common.test.ts';
import {
	commonPgTests,
	createAllDataTypesTable,
	defaultValue,
	dropAllDataTypesTable,
	nodePgTests,
} from '../pg-core.ts';

let pgClient: VercelClient;
let pgConnectionStringPool: string;
let pgConnectionStringClient: string;

let sql: SQL;
beforeAll(async () => {
	const pgConnectionStringPool_ = process.env['VERCEL_POOL_CONNECTION_STRING'];
	if (!pgConnectionStringPool_) {
		throw new Error('VERCEL_POOL_CONNECTION_STRING is not defined');
	}
	pgConnectionStringPool = pgConnectionStringPool_!;

	const pgConnectionStringClient_ = process.env['VERCEL_CLIENT_CONNECTION_STRING'];
	if (!pgConnectionStringClient_) {
		throw new Error('VERCEL_CLIENT_CONNECTION_STRING is not defined');
	}
	pgConnectionStringClient = pgConnectionStringClient_!;

	pgClient = createClient({ connectionString: pgConnectionStringClient });
	await pgClient.connect();
	sql = waddler({ client: pgClient });
});

afterAll(async () => {
	await pgClient?.end().catch(console.error);
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

test('connection test', async () => {
	// client connection test
	const client = createClient({ connectionString: pgConnectionStringClient });
	await client.connect();

	const sql12 = waddler({ client });
	await sql12`select 12;`;
	await client.end();

	// pool connection test
	const pool = createPool({ connectionString: pgConnectionStringPool });

	const sql22 = waddler({ client: pool });
	await sql22`select 22;`;
	await pool.end();
});

nodePgTests();

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
		Buffer.from('qwerty'),
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
		bytea: Buffer.from('qwerty'),
		default: defaultValue,
	};

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const client = createClient({ connectionString: pgConnectionStringClient });
	await client.connect();
	const sqlClient = waddler({ client, extensions: [queryStream()] });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(row).toStrictEqual(expectedRes);
	}

	await client.end();

	const pool = createPool({ connectionString: pgConnectionStringPool });
	const sqlPool = waddler({ client: pool, extensions: [queryStream()] });
	const streamPool = sqlPool`select * from all_data_types;`.stream();
	for await (const row of streamPool) {
		expect(row).toStrictEqual(expectedRes);
	}

	await pool.end();
});
