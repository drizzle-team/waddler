import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { beforeAll, beforeEach, expect, test } from 'vitest';
import type { SQL } from 'waddler';
import type { NeonHttpClient } from 'waddler/neon-http';
import { sql as sqlQuery, waddler } from 'waddler/neon-http';
import { commonTests } from '../../common.test.ts';
import { commonPgTests, createUsersTable, dropUsersTable, nodePgTests } from '../pg-core.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

let pgClient: NeonHttpClient;
let connectionString: string;

let sql: ReturnType<typeof waddler>;
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

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		query: 'select * from "users" where id = $1 or id = $2 and email = $3',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = $1 or id = $2 and email = $3',
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
