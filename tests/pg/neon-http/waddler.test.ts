import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { commonTests } from 'tests/common.test.ts';
import { commonPgTests, nodePgTests } from 'tests/pg/pg-core.ts';
import { beforeAll, beforeEach, test } from 'vitest';
import type { NeonHttpClient } from '../../../src/pg/neon-http';
import { waddler } from '../../../src/pg/neon-http';
import type { SQL } from '../../../src/sql.ts';

let pgClient: NeonHttpClient;
let connectionString: string;

let sql: SQL;
beforeAll(async () => {
	const connectionString_ = process.env['NEON_HTTP_CONNECTION_STRING'];
	if (!connectionString_) {
		throw new Error('NEON_HTTP_CONNECTION_STRING is not defined');
	}
	connectionString = connectionString_;
	pgClient = neon(connectionString);
	sql = waddler({ client: pgClient });
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

test('connection test', async () => {
	const client = neon(connectionString);
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	const sql2 = waddler(connectionString);
	await sql2`select 2;`;

	const sql3 = waddler({ connection: connectionString });
	await sql3`select 3;`;

	const sql4 = waddler({ connection: { connectionString } });
	await sql4`select 4;`;
});

nodePgTests();
