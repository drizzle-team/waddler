// TODO revise: do I need to test this?

import 'dotenv/config';
import { type Client, createClient } from '@libsql/client-wasm';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { LibsqlSQL } from 'waddler/libsql';
import { waddler } from 'waddler/libsql/wasm';
import { commonTests } from '../../common.test.ts';
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

	// uses sqlite3 client so you can't use remote db with libsql-wasm
});

test('logger test', async () => {
	const loggerQuery = 'select ?;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	const logger = {
		logQuery: (query: string, params: unknown[]) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
		},
	};

	let loggerSql: LibsqlSQL;

	// case 0
	const client = createClient({
		url: ':memory:',
	});
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	loggerSql = waddler(':memory:', { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(':memory:', { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler(':memory:', { logger: false });
	await loggerSql`select ${1};`;

	consoleMock.mockRestore();
});

libsqlTests('wasm');

// sql.stream, sql.unsafe(...).stream()
