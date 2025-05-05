import { type Client, createClient } from '@libsql/client/sqlite3';
import { afterAll, beforeAll, beforeEach, test } from 'vitest';
import type { LibsqlSQL } from 'waddler/libsql';
import { waddler } from 'waddler/libsql/sqlite3';
import { commonTests } from '../../common.test';
import { commonSqliteTests } from '../sqlite-core.ts';
import { libsqlTests } from './common.ts';

let sql: LibsqlSQL;
let client: Client;

beforeAll(async () => {
	client = createClient({
		url: ':memory:',
		intMode: 'number',
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
});

libsqlTests();

// sql.stream, sql.unsafe(...).stream()
