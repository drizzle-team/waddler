import 'dotenv/config';
import { Client } from '@neondatabase/serverless';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { commonTests } from '../../common.test.ts';
import {
	commonPgTests,
	createAllDataTypesTable,
	defaultValue,
	dropAllDataTypesTable,
	nodePgTests,
} from '../pg-core.ts';

import type { SQL } from 'waddler';
import { queryStream } from 'waddler/extensions/pg-query-stream';
import type { NeonClient } from 'waddler/neon-serverless';
import { waddler } from 'waddler/neon-serverless';

let pgClient: NeonClient;
let connectionString: string;

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	const connectionString_ = process.env['NEON_SERVERLESS_CONNECTION_STRING'];
	if (!connectionString_) {
		throw new Error('NEON_SERVERLESS_CONNECTION_STRING is not defined');
	}
	connectionString = connectionString_;
	pgClient = new Client(connectionString);
	await pgClient.connect();
	sql = waddler({ client: pgClient });
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

afterAll(async () => {
	await (pgClient as Client).end();
});

commonTests();
commonPgTests();

test('connection test', async () => {
	const client = new Client(connectionString);
	await client.connect();

	const sql1 = waddler({ client });
	await sql1`select 1;`;

	await client.end();

	const sql3 = waddler(connectionString);
	await sql3`select 3;`;

	const sql4 = waddler({ connection: connectionString });
	await sql4`select 4;`;

	const sql5 = waddler({ connection: { connectionString } });
	await sql5`select 5;`;

	// TODO: add case with ws connection
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

	const sqlClient = waddler({ client: pgClient, extensions: [queryStream()] });
	const streamClient = sqlClient`select * from all_data_types;`.stream();
	for await (const row of streamClient) {
		expect(row).toStrictEqual(expectedRes);
	}
});
