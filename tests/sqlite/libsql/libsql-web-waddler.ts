// TODO revise: do I need to test this?
import 'dotenv/config';
import { type Client, createClient } from '@libsql/client/web';
import retry from 'async-retry';
import { commonTests } from 'tests/common.test';
import { commonSqliteTests } from 'tests/sqlite/sqlite-core.ts';
import { afterAll, beforeAll, beforeEach, test } from 'vitest';
import type { LibsqlSQL } from '../../../src/sqlite/libsql/driver-core.ts';
import { waddler } from '../../../src/sqlite/libsql/web/index.ts';
import { libsqlTests } from './common.ts';

let sql: LibsqlSQL;
let client: Client;

beforeAll(async () => {
	const url = process.env['LIBSQL_REMOTE_URL'];
	const authToken = process.env['LIBSQL_REMOTE_TOKEN'];
	if (!url) {
		throw new Error('LIBSQL_REMOTE_URL is not set');
	}

	client = await retry(async () => {
		client = createClient({ url, authToken, intMode: 'number' });
		return client;
	}, {
		retries: 20,
		factor: 1,
		minTimeout: 250,
		maxTimeout: 250,
		randomize: false,
		onRetry() {
			client?.close();
		},
	});
	sql = waddler({ client });
});

beforeEach<{ sql: LibsqlSQL }>((ctx) => {
	ctx.sql = sql;
});

afterAll(() => {
	client?.close();
});

commonTests();
commonSqliteTests();

test('connection test', async () => {
	const url = process.env['LIBSQL_REMOTE_URL'];
	const authToken = process.env['LIBSQL_REMOTE_TOKEN'];
	if (!url) {
		throw new Error('LIBSQL_REMOTE_URL is not set');
	}

	client = await retry(async () => {
		client = createClient({ url, authToken, intMode: 'number' });
		return client;
	}, {
		retries: 20,
		factor: 1,
		minTimeout: 250,
		maxTimeout: 250,
		randomize: false,
		onRetry() {
			client?.close();
		},
	});

	const sql2 = waddler({ client });
	await sql2`select 2;`.all();

	client.close();

	// TODO: revise: is it possible to connect without token?
	// const sql3 = waddler(url);
	// await sql3`select 3;`.all();

	// const sql4 = waddler({ connection: url });
	// await sql4`select 4;`.all();

	const sql5 = waddler({ connection: { url, authToken } });
	await sql5`select 5;`.all();
});

libsqlTests();

// sql.stream, sql.unsafe(...).stream()
