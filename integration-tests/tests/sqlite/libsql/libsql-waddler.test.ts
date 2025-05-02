import 'dotenv/config';
import { type Client, createClient } from '@libsql/client';
import retry from 'async-retry';
import { afterAll, beforeAll, beforeEach, test } from 'vitest';
import type { LibsqlSQL } from '../../../../waddler/src/sqlite/libsql/driver-core.ts';
import { waddler } from '../../../../waddler/src/sqlite/libsql/index.ts';
import { commonTests } from '../../common.test';
import { commonSqliteTests } from '../sqlite-core.ts';
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
	// @ts-expect-error
	ctx.sql = sql;
});

afterAll(() => {
	client?.close();
});

commonTests();
commonSqliteTests();

test('connection test', async () => {
	const client = createClient({
		url: ':memory:',
	});

	const sql2 = waddler({ client });
	await sql2`select 2;`.all();

	client.close();

	const sql3 = waddler(':memory:');
	await sql3`select 3;`.all();

	const sql4 = waddler({ connection: ':memory:' });
	await sql4`select 4;`.all();

	const sql5 = waddler({ connection: { url: ':memory:' } });
	await sql5`select 5;`.all();

	const url = process.env['LIBSQL_REMOTE_URL'];
	const authToken = process.env['LIBSQL_REMOTE_TOKEN'];
	if (!url) {
		throw new Error('LIBSQL_REMOTE_URL is not set');
	}

	const sql6 = waddler({ connection: { url, authToken } });
	await sql6`select 6;`.all();

	const client_ = await retry(async () => {
		const client = createClient({ url, authToken, intMode: 'number' });
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

	const sql8 = waddler({ client: client_ });
	await sql8`select 8;`.all();
	client_?.close();
});

libsqlTests();

// sql.stream, sql.unsafe(...).stream()
