/// <reference types="@cloudflare/workers-types" />
import { expect } from 'chai';
import { DurableObject } from 'cloudflare:workers';
import { type DurableSqliteSQL, sql as sqlQuery, waddler } from 'waddler/durable-sqlite';
import { createAllDataTypesTable, createUsersTable, dropAllDataTypesTable, dropUsersTable } from '../sqlite-core';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

export class MyDurableObject extends DurableObject {
	testsPassed: number = 0;
	testsFailed: number = 0;
	sql: DurableSqliteSQL;

	loggerSql0: DurableSqliteSQL;
	loggerSql1: DurableSqliteSQL;
	loggerSql2: DurableSqliteSQL;
	loggerText: string;

	constructor(ctx: DurableObjectState, env: Env) {
		// Required, as we are extending the base class.
		super(ctx, env);
		this.sql = waddler({ client: this.ctx.storage });

		// logger
		const loggerQuery = 'select ?;';
		const loggerParams = [1];
		this.loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

		// metadata example
		// { columnNames: [ '?' ], rowsRead: 0, rowsWritten: 0 }
		const logger = {
			logQuery: (query: string, params: unknown[], metadata: any) => {
				expect(query).equal(loggerQuery);
				expect(params).deep.equal(loggerParams);
				const metadataKeys = Object.keys(metadata);
				const predicate = ['columnNames', 'rowsRead', 'rowsWritten'].map((key) => metadataKeys.includes(key)).every(
					(value) => value === true,
				);
				expect(predicate).equal(true);
			},
		};

		this.loggerSql0 = waddler({ client: this.ctx.storage, config: { logger } });
		this.loggerSql1 = waddler({ client: this.ctx.storage, config: { logger: true } });
		this.loggerSql2 = waddler({ client: this.ctx.storage, config: { logger: false } });

		// Make sure all table creations complete before accepting queries.
		ctx.blockConcurrencyWhile(async () => {
			await this.createTable();
		});
	}

	async sayHello() {
		return `Tests	${this.testsFailed} failed | ${this.testsPassed} passed (${this.testsFailed + this.testsPassed}) `;
	}

	async loggerTest() {
		try {
			await this.loggerSql0`select ${1};`;
			await this.loggerSql1`select ${1};`;
			await this.loggerSql2`select ${1};`;

			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('all types in sql.unsafe test error.');
		}
	}

	async allTypesInSqlUnsafe() {
		try {
			await dropAllDataTypesTable(this.sql);
			await createAllDataTypesTable(this.sql);

			const values = [
				2147483647,
				// TODO: change to BigInt('9007199254740992') + BigInt(1) when Durable objects supports BigInt
				9007199254740992,
				101.23,
				'qwerty',
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				9007199254740992,
				Buffer.from('qwerty'),
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				10.23,
			];

			await this.sql.unsafe(
				`insert into all_data_types values (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
				values,
			).run();

			const res = await this.sql.unsafe(`select * from all_data_types;`);

			const expectedRes = {
				integer_number: 2147483647,
				integer_bigint: 9007199254740992,
				real: 101.23,
				text: 'qwerty',
				text_json: JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				blob_bigint: 9007199254740992,
				blob_buffer: new Uint8Array(Buffer.from('qwerty')).buffer,
				blob_json: JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				numeric: 10.23,
			};

			expect(res[0]).deep.equal(expectedRes);

			// same as select query as above but with rowMode: "array"
			const arrayResult = await this.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();
			expect(arrayResult[0]).deep.equal(Object.values(expectedRes));
			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('all types in sql.unsafe test error.');
		}
	}

	async allTypesInSqlValues() {
		try {
			await dropAllDataTypesTable(this.sql);
			await createAllDataTypesTable(this.sql);

			const allDataTypesValues = [
				2147483647,
				9007199254740992, // BigInt('9007199254740992') + BigInt(1),
				101.23,
				`qwe'"rty`,
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				9007199254740992, // BigInt('9007199254740992') + BigInt(1),
				Buffer.from('qwerty'),
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				10.23,
			];

			const expectedRes = [
				2147483647,
				9007199254740992,
				101.23,
				`qwe'"rty`,
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				9007199254740992,
				new Uint8Array(Buffer.from('qwerty')).buffer,
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				10.23,
			];

			await this.sql`insert into ${this.sql.identifier('all_data_types')} values ${
				this.sql.values([allDataTypesValues])
			};`.run();

			const res = await this.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();

			expect(res[0]).deep.equal(expectedRes);
			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('all types in sql.values test error.');
		}
	}

	async sqlStream() {
		try {
			await dropAllDataTypesTable(this.sql);
			await createAllDataTypesTable(this.sql);

			const allDataTypesValues = [
				2147483647,
				9007199254740992,
				101.23,
				'qwerty',
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				9007199254740992,
				Buffer.from('qwerty'),
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				10.23,
			];

			const expectedRes = [
				2147483647,
				9007199254740992,
				101.23,
				'qwerty',
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				9007199254740992,
				new Uint8Array(Buffer.from('qwerty')).buffer,
				JSON.stringify({
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}),
				10.23,
			];

			await this.sql`insert into ${this.sql.identifier('all_data_types')} values ${
				this.sql.values([allDataTypesValues])
			};`.run();

			const queryStream = this.sql`select * from ${this.sql.identifier('all_data_types')}`.stream();
			for await (const row of queryStream) {
				expect(Object.values(row)).deep.equal(expectedRes);
			}

			// sql.unsafe(...).stream()
			const unsafeQueryStream = this.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).stream();
			for await (const row of unsafeQueryStream) {
				expect(row).deep.equal(expectedRes);
			}
			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('sql.stream test error.');
		}
	}

	async sqlQueryApi() {
		try {
			const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
			filter.append(sqlQuery` and email = ${'hello@test.com'}`);

			const query = this.sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

			expect(query.toSQL()).deep.equal({
				sql: 'select * from "users" where id = ? or id = ? and email = ?;',
				params: [1, 2, 'hello@test.com'],
			});
			expect(filter.toSQL()).deep.equal({
				sql: 'id = ? or id = ? and email = ?',
				params: [1, 2, 'hello@test.com'],
			});

			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('sql.stream test error.');
		}
	}

	async embedingSQLQueryAndSQLTemplate() {
		try {
			await dropUsersTable(this.sql);
			await createUsersTable(this.sql);

			await this.sql`insert into users values ${
				this.sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
			}`.run();

			await this.sql`select * from ${this.sql.identifier('users')};`;

			const query1 = this.sql`select * from ${this.sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
			expect(query1.toSQL()).deep.equal({
				sql: 'select * from "users" where id = ? and name = ?;',
				params: [1, 'a'],
			});

			const res1 = await query1;
			expect(res1.length).not.equal(0);

			const query2 = this.sql`select * from ${this.sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
			expect(query2.toSQL()).deep.equal({
				sql: 'select * from "users" where id = ? and name = ?;',
				params: [1, 'a'],
			});

			const res2 = await query2;
			expect(res2.length).not.equal(0);

			const query3 = this.sql`select * from ${this.sql.identifier('users')} where ${this.sql`id = ${1}`};`;
			expect(query3.toSQL()).deep.equal({
				sql: 'select * from "users" where id = ?;',
				params: [1],
			});

			const res3 = await query3;
			expect(res3.length).not.equal(0);

			await dropUsersTable(this.sql);

			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('sql.stream test error.');
		}
	}

	async standaloneSqlTest() {
		try {
			const timestampSelector = sqlQuery`toStartOfHour(${sqlQuery.identifier('test')})`;
			const timestampFilter =
				sqlQuery`${sqlQuery``}${timestampSelector} >= from and ${timestampSelector} < to${sqlQuery``}${sqlQuery`;`}`;

			expect(timestampFilter.toSQL()).deep.equal({
				sql: 'toStartOfHour("test") >= from and toStartOfHour("test") < to;',
				params: [],
			});

			this.testsPassed += 1;
		} catch (error) {
			console.error(error);
			this.testsFailed += 1;
			// throw new Error('sql.stream test error.');
		}
	}

	async insertAndList(user: any[]) {
		await this.insert(user);
		return this.select();
	}

	async insert(user: any[]) {
		await this.sql`
    		insert into ${this.sql.identifier('users')}(${this.sql.identifier(['name', 'age', 'email'])}) 
      		values ${this.sql.values([user])};
  		`.run();
	}

	async select(): Promise<any[]> {
		const users = await this.sql`select * from ${this.sql.identifier('users')};`.all();
		return users;
	}

	async createTable() {
		await this.sql.unsafe(`create table if not exists users (
    id    integer primary key autoincrement,
    name  text    not null,
    age   integer not null,
    email text    not null unique
    );
  `).run();
	}
}
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const id = env.MY_DURABLE_OBJECT.idFromName(new URL(request.url).pathname);

		const stub = env.MY_DURABLE_OBJECT.get(id);

		await stub.allTypesInSqlUnsafe();
		await stub.allTypesInSqlValues();
		await stub.sqlStream();
		await stub.sqlQueryApi();
		await stub.embedingSQLQueryAndSQLTemplate();
		await stub.standaloneSqlTest();
		await stub.loggerTest();

		const greeting = await stub.sayHello() as string;

		// Option A - Maximum performance.
		// Prefer to bundle all the database interaction within a single Durable Object call
		// for maximum performance, since database access is fast within a DO.
		// const usersAll = await stub.insertAndList([
		// 	'John',
		// 	30,
		// 	'johnA@example.com',
		// ]);
		// console.log('New user created. Getting all users from the database:', usersAll);

		// Option B - Slow but maybe useful sometimes for debugging.
		// You can also directly call individual Drizzle queries if they are exposed
		// but keep in mind every query is a round-trip to the Durable Object instance.
		// await stub.insert([
		// 	'John',
		// 	30,
		// 	'johnB@example.com',
		// ]);
		// console.log('New user created!');

		// const users = await stub.select();
		// console.log('Getting all users from the database:', users);

		// return Response.json(users);
		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;

// npx wrangler dev
