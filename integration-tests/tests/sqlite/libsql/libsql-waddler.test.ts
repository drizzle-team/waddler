import 'dotenv/config';
import { type Client, createClient } from '@libsql/client';
import retry from 'async-retry';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { LibsqlSQL } from 'waddler/libsql';
import { sql as sqlQuery, waddler } from 'waddler/libsql';
import { commonTests } from '../../common.test';
import { commonSqliteTests, createUsersTable, dropUsersTable } from '../sqlite-core.ts';
import { libsqlTests } from './common.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

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
	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});

	// case 0
	const client = createClient({
		url: ':memory:',
	});
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(loggerText);

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	loggerSql = waddler(':memory:', { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(':memory:', { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(loggerText);

	loggerSql = waddler(':memory:', { logger: false });
	await loggerSql`select ${1};`;
});

libsqlTests();

// sql.stream, sql.unsafe(...).stream()

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		query: 'select * from "users" where id = ? or id = ? and email = ?',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = ? or id = ? and email = ?',
		params: [1, 2, 'hello@test.com'],
	});
});

test('embeding SQLQuery and SQLTemplate test', async () => {
	await dropUsersTable(sql);
	await createUsersTable(sql);

	await sql`insert into users values ${
		sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
	}`.run();

	await sql`select * from ${sql.identifier('users')};`;
	// console.log(res);

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	// console.log(query1.toSQL());
	// console.log(await query1);
	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	// console.log(query2.toSQL());
	// console.log(await query2);
	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	// console.log(query3.toSQL());
	const res3 = await query3;
	// console.log(res3);
	expect(res3.length).not.toBe(0);

	await dropUsersTable(sql);
});
