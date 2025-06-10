/// <reference types="@cloudflare/workers-types" />
import { expect } from 'chai';
import { DurableObject } from 'cloudflare:workers';
import { type DurableSqliteSQL, waddler } from 'waddler/durable-sqlite';
import { createAllDataTypesTable, dropAllDataTypesTable } from '../sqlite-core';

export class MyDurableObject extends DurableObject {
	testsPassed: number = 0;
	testsFailed: number = 0;
	sql: DurableSqliteSQL;
	constructor(ctx: DurableObjectState, env: Env) {
		// Required, as we are extending the base class.
		super(ctx, env);
		this.sql = waddler({ client: this.ctx.storage });

		// Make sure all table creations complete before accepting queries.
		ctx.blockConcurrencyWhile(async () => {
			await this.createTable();
		});
	}

	async sayHello() {
		return `Tests	${this.testsFailed} failed | ${this.testsPassed} passed (${this.testsFailed + this.testsPassed}) `;
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
				'qwerty',
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
