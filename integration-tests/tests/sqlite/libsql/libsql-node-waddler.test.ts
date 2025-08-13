import 'dotenv/config';
import { type Client, createClient } from '@libsql/client/http';
import retry from 'async-retry';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { LibsqlSQL } from 'waddler/libsql';
import { waddler } from 'waddler/libsql/http';
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

test('logger test', async () => {
	const loggerQuery = 'select ?;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	const logger = {
		logQuery: (query: string, params: unknown[], metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);

			const metadataKeys = Object.keys(metadata);
			const predicate = ['columnTypes', 'columns', 'lastInsertRowid', 'rowsAffected'].map((key) =>
				metadataKeys.includes(key)
			).every(
				(value) => value === true,
			);
			expect(predicate).toBe(true);
		},
	};

	let loggerSql: LibsqlSQL;

	// case 0
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

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	consoleMock.mockRestore();
});

libsqlTests();

// sql.stream, sql.unsafe(...).stream()
