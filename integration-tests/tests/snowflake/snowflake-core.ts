import { describe, expect, test } from 'vitest';
import type { SnowflakeSQL } from 'waddler/snowflake';

export const createUsersTable = async (sql: SnowflakeSQL) => {
	await sql`create or replace table ${sql.identifier('users')}(
    id    integer,
    name  string,
    age   integer,
    email string
	);`;
};

export const dropUsersTable = async (sql: SnowflakeSQL) => {
	await sql`drop table if exists ${sql.identifier('users')};`;
};

export const commonSnowflakeTests = () => {
	describe('common_snowflake_tests', () => {
		test<{ sql: SnowflakeSQL }>('toSQL number param test', (ctx) => {
			const res = ctx.sql`select ${1};`.toSQL();
			expect(res).toStrictEqual({ sql: 'select ?;', params: [1] });
		});

		test<{ sql: SnowflakeSQL }>('sql.identifier object test', (ctx) => {
			const res = ctx.sql`select * from ${ctx.sql.identifier({ schema: 'PUBLIC', table: 'USERS' })};`.toSQL();
			expect(res).toStrictEqual({ sql: 'select * from "PUBLIC"."USERS";', params: [] });
		});

		test<{ sql: SnowflakeSQL }>('sql.identifier database object test', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier({ database: 'DB', schema: 'PUBLIC', table: 'USERS', column: 'ID' })
			};`.toSQL();
			expect(res).toStrictEqual({ sql: 'select "DB"."PUBLIC"."USERS"."ID";', params: [] });
		});

		test<{ sql: SnowflakeSQL }>('sql.default with sql.values test', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values ${ctx.sql.values([[ctx.sql.default, 'name1']])};`.toSQL();
			expect(res).toStrictEqual({ sql: 'insert into users (id, name) values (default, ?);', params: ['name1'] });
		});

		test<{ sql: SnowflakeSQL }>('stream unsupported assumptions test', async (ctx) => {
			await expect(async () => {
				for await (const _row of ctx.sql`select 1;`.stream()) {
					return;
				}
			}).resolves.not.toThrow();
		});
	});
};
