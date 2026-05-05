import 'dotenv/config';
import snowflake, { type Connection, type ConnectionOptions } from 'snowflake-sdk';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { SQL } from 'waddler';
import { sql as sqlQuery, waddler } from 'waddler/snowflake';
import { commonTests } from '../common.test.ts';
import { commonSnowflakeTests, createUsersTable, dropUsersTable } from './snowflake-core.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

let snowflakeClient: Connection | undefined;

let sql: ReturnType<typeof waddler>;

const snowflakeEnvReady = Boolean(
	process.env['RUN_EXTERNAL_DB_TESTS']
		&& process.env['SNOWFLAKE_ACCOUNT']
		&& process.env['SNOWFLAKE_USERNAME']
		&& process.env['SNOWFLAKE_PASSWORD'],
);

const getConnectionOptions = (): ConnectionOptions => {
	const account = process.env['SNOWFLAKE_ACCOUNT'];
	const username = process.env['SNOWFLAKE_USERNAME'];
	const password = process.env['SNOWFLAKE_PASSWORD'];
	if (!account || !username || !password) {
		throw new Error('SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, and SNOWFLAKE_PASSWORD must be set');
	}

	return {
		account,
		username,
		password,
		database: process.env['SNOWFLAKE_DATABASE'],
		schema: process.env['SNOWFLAKE_SCHEMA'],
		warehouse: process.env['SNOWFLAKE_WAREHOUSE'],
		role: process.env['SNOWFLAKE_ROLE'],
	};
};

const toConnectionString = (options: ConnectionOptions): string => {
	const username = encodeURIComponent(options.username!);
	const password = encodeURIComponent(options.password!);
	const account = options.account!;
	const path = [options.database, options.schema].filter(Boolean).join('/');
	const query = new URLSearchParams();
	if (options.warehouse) query.set('warehouse', options.warehouse);
	if (options.role) query.set('role', options.role);

	return `snowflake://${username}:${password}@${account}${path ? `/${path}` : ''}${
		query.size ? `?${query.toString()}` : ''
	}`;
};

const connect = async (connectionOptions: ConnectionOptions) => {
	const client = snowflake.createConnection(connectionOptions);

	await new Promise<void>((resolve, reject) => {
		client.connect((err) => {
			if (err) {
				reject(err);
				return;
			}

			resolve();
		});
	});

	return client;
};

beforeAll(async () => {
	if (!snowflakeEnvReady) {
		return;
	}

	const connectionOptions = getConnectionOptions();
	snowflakeClient = await connect(connectionOptions);
	sql = waddler({ client: snowflakeClient });
	await sql`select 1;`;
});

afterAll(async () => {
	const client = snowflakeClient;
	if (!client) return;

	await new Promise<void>((resolve) => {
		client.destroy(() => resolve());
	});
});

beforeEach<{ sql: SQL }>((ctx) => {
	if (!snowflakeEnvReady) return;
	ctx.sql = sql;
});

if (snowflakeEnvReady) {
	commonTests();
	commonSnowflakeTests();

	test('connection test', async () => {
		const connectionOptions = getConnectionOptions();

		const client = await connect(connectionOptions);
		const sql1 = waddler({ client });
		await sql1`select 1;`;
		await new Promise<void>((resolve) => {
			client.destroy(() => resolve());
		});

		const sql2 = waddler({ connection: connectionOptions });
		await sql2`select 2;`;

		const connectionString = toConnectionString(connectionOptions);
		const sql3 = waddler(connectionString);
		await sql3`select 3;`;

		const sql4 = waddler({ connection: connectionString });
		await sql4`select 4;`;
	});

	test('logger test', async () => {
		const loggerQuery = 'select ?;';
		const loggerParams = [1];

		const logger = {
			logQuery: (query: string, params: unknown[], metadata: any) => {
				expect(query).toEqual(loggerQuery);
				expect(params).toStrictEqual(loggerParams);
				expect(typeof metadata.queryId).toBe('string');
			},
		};

		const connectionOptions = getConnectionOptions();
		const client = await connect(connectionOptions);
		let loggerSql: SQL;

		loggerSql = waddler({ client, logger });
		await loggerSql`select ${1};`;

		const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
		loggerSql = waddler({ client, logger: true });
		await loggerSql`select ${1};`;
		expect(consoleMock).toBeCalledWith(expect.stringContaining('Query: select ?; -- params: [1]'));

		loggerSql = waddler({ client, logger: false });
		await loggerSql`select ${1};`;

		await new Promise<void>((resolve) => {
			client.destroy(() => resolve());
		});
		consoleMock.mockRestore();
	});

	test('sql query api test', async () => {
		const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
		filter.append(sqlQuery` and email = ${'hello@test.com'}`);

		const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

		expect(query.toSQL()).toStrictEqual({
			sql: 'select * from "users" where id = ? or id = ? and email = ?;',
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

		await sql`insert into ${sql.identifier('users')} values ${
			sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
		}`;

		await sql`select * from ${sql.identifier('users')};`;

		const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
		expect(query1.toSQL()).toStrictEqual({
			sql: 'select * from "users" where id = ? and name = ?;',
			params: [1, 'a'],
		});

		const res1 = await query1;
		expect(res1.length).not.toBe(0);

		const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
		expect(query2.toSQL()).toStrictEqual({
			sql: 'select * from "users" where id = ? and name = ?;',
			params: [1, 'a'],
		});

		const res2 = await query2;
		expect(res2.length).not.toBe(0);

		const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
		expect(query3.toSQL()).toStrictEqual({
			sql: 'select * from "users" where id = ?;',
			params: [1],
		});

		const res3 = await query3;
		expect(res3.length).not.toBe(0);

		await dropUsersTable(sql);
	});

	test('standalone sql test', async () => {
		const timestampSelector = sqlQuery`DATE_TRUNC('HOUR', ${sqlQuery.identifier('test')})`;
		const timestampFilter =
			sqlQuery`${sqlQuery``}${timestampSelector} >= from and ${timestampSelector} < to${sqlQuery``}${sqlQuery`;`}`;

		expect(timestampFilter.toSQL()).toStrictEqual({
			sql: 'DATE_TRUNC(\'HOUR\', "test") >= from and DATE_TRUNC(\'HOUR\', "test") < to;',
			params: [],
		});
	});
} else {
	test.skip('Snowflake tests require RUN_EXTERNAL_DB_TESTS and Snowflake credentials', () => {});
}
