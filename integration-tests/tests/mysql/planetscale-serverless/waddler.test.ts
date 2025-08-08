import 'dotenv/config';
import { Client } from '@planetscale/database';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler';
import { sql as sqlQuery, waddler } from 'waddler/planetscale-serverless';
import { commonTests } from '../../common.test';
import { commonMysqlAllTypesTests, commonMysqlTests, createUsersTable, dropUsersTable } from '../mysql-core';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	const connectionString = process.env['PLANETSCALE_CONNECTION_STRING'];
	if (!connectionString) {
		throw new Error('PLANETSCALE_CONNECTION_STRING is not set');
	}

	const client = new Client({ url: connectionString });
	sql = waddler({ client });
	await sql`select 1;`;
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

test('connection test', async () => {
	const connectionString = process.env['PLANETSCALE_CONNECTION_STRING'];
	if (!connectionString) {
		throw new Error('PLANETSCALE_CONNECTION_STRING is not set');
	}

	const client = new Client({ url: connectionString });
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	const sql2 = waddler(connectionString);
	await sql2`select 2;`;

	const sql3 = waddler({ connection: connectionString });
	await sql3`select 3;`;
});

test('logger test', async () => {
	const loggerQuery = 'select ?;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	// metadata example:
	// {
	// 	headers: [ ':vtg1 /* INT64 */' ],
	// 	types: { ':vtg1 /* INT64 */': 'INT64' },
	// 	fields: [
	// 	  {
	// 	    name: ':vtg1 /* INT64 */',
	// 	    type: 'INT64',
	// 	    charset: 63,
	// 	    flags: 32768
	// 	  }
	// 	],
	// 	rowsAffected: 0,
	// 	insertId: '0',
	// 	size: 1,
	// 	statement: 'select 1;',
	// 	time: 1.23636
	// }
	const logger = {
		logQuery: (query: string, params: unknown[], metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);
			expect(Object.keys(metadata)).toStrictEqual([
				'headers',
				'types',
				'fields',
				'rowsAffected',
				'insertId',
				'size',
				'statement',
				'time',
			]);
		},
	};
	let loggerSql: SQL;

	const connectionString = process.env['PLANETSCALE_CONNECTION_STRING'];
	if (!connectionString) {
		throw new Error('PLANETSCALE_CONNECTION_STRING is not set');
	}

	// case 0
	const client = new Client({ url: connectionString });
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	// case 1
	loggerSql = waddler(connectionString, { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(connectionString, { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler(connectionString, { logger: false });
	await loggerSql`select ${1};`;

	consoleMock.mockRestore();
});

commonTests();
commonMysqlTests();

// ALL TYPES with sql.unsafe and sql.values-------------------------------------------------------------------
commonMysqlAllTypesTests('planetscale-serverless');

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ? or id = ? and email = ?;',
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
	}`;

	await sql`select * from ${sql.identifier('users')};`;

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	expect(query1.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ? and name = ?;',
		params: [1, 'a'],
	});

	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ? and name = ?;',
		params: [1, 'a'],
	});

	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = ?;',
		params: [1],
	});

	const res3 = await query3;
	expect(res3.length).not.toBe(0);

	await dropUsersTable(sql);
});

test('standalone sql test', async () => {
	const timestampSelector = sqlQuery`toStartOfHour(${sqlQuery.identifier('test')})`;
	const timestampFilter =
		sqlQuery`${sqlQuery``}${timestampSelector} >= from and ${timestampSelector} < to${sqlQuery``}${sqlQuery`;`}`;

	expect(timestampFilter.toSQL()).toStrictEqual({
		sql: 'toStartOfHour(`test`) >= from and toStartOfHour(`test`) < to;',
		params: [],
	});
});
