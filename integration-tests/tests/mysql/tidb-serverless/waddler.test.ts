import 'dotenv/config';
import { connect } from '@tidbcloud/serverless';
import { beforeAll, beforeEach, test } from 'vitest';
import type { SQL } from 'waddler';
import { waddler } from '../../../../waddler/src/mysql/tidb-serverless';
import { commonTests } from '../../common.test';
import { commonMysqlAllTypesTests, commonMysqlTests } from '../../mysql/mysql-core';

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	const connectionString = process.env['TIDB_CONNECTION_STRING'];
	if (!connectionString) {
		throw new Error('TIDB_CONNECTION_STRING is not set');
	}

	const client = connect({ url: connectionString });
	sql = waddler({ client });
	await sql`select 1;`;
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

test('connection test', async () => {
	const connectionString = process.env['TIDB_CONNECTION_STRING'];
	if (!connectionString) {
		throw new Error('TIDB_CONNECTION_STRING is not set');
	}

	const client = connect({ url: connectionString });
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	const sql2 = waddler(connectionString);
	await sql2`select 2;`;

	const sql3 = waddler({ connection: connectionString });
	await sql3`select 3;`;
});

commonTests();
commonMysqlTests();

// ALL TYPES with sql.unsafe and sql.values-------------------------------------------------------------------
commonMysqlAllTypesTests('tidb-serverless');
