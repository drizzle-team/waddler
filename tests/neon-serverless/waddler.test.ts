import 'dotenv/config';
import { Client } from '@neondatabase/serverless';
import { commonTests } from 'tests/common.test.ts';
import { commonPgTests } from 'tests/pg-core.ts';
import { afterAll, beforeAll, beforeEach, test } from 'vitest';

import { neonTests } from 'tests/neon.ts';
import type { NeonClient } from '../../src/neon-serverless';
import { waddler } from '../../src/neon-serverless';
import type { SQL } from '../../src/sql.ts';

let pgClient: NeonClient;
let connectionString: string;

let sql: SQL;
beforeAll(async () => {
	const connectionString_ = process.env['NEON_CONNECTION_STRING'];
	if (!connectionString_) {
		throw new Error('NEON_CONNECTION_STRING is not defined');
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

	const sql2 = waddler(client);
	await sql2`select 2;`;

	await client.end();

	const sql3 = waddler(connectionString);
	await sql3`select 3;`;

	const sql4 = waddler({ connection: connectionString });
	await sql4`select 4;`;

	const sql5 = waddler({ connection: { connectionString } });
	await sql5`select 5;`;

	// TODO: add case with ws connection
});

neonTests();
