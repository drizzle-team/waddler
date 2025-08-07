// This file serves only as a reference for what and how I'm testing in a detached project.
import type { DB } from '@op-engineering/op-sqlite';
import { Buffer } from 'buffer';
import { expect } from 'chai';
import { type OpSqliteSQL, sql as sqlQuery, waddler } from 'waddler/op-sqlite';
import { filter1 } from './test-filters1';
import { filter2 } from './test-filters2';

export const createAllDataTypesTable = async (sql: OpSqliteSQL) => {
	await sql`
		    CREATE TABLE "all_data_types" (
			"integer_number" integer,
			"integer_bigint" integer,
			"real" real,
			"text" text,
			"text_json" text,
			"blob_bigint" blob,
			"blob_buffer" blob,
			"blob_json" blob,
			"numeric" numeric
		);
	`.run();
};

export const dropAllDataTypesTable = async (sql: OpSqliteSQL) => {
	await sql`drop table if exists "all_data_types";`.run();
};

export const createUsersTable = async (sql: OpSqliteSQL) => {
	await sql.unsafe(`create table users(
    id    integer,
    name  text,
    age   integer,
    email text
	);`).run();
};

export const dropUsersTable = async (sql: OpSqliteSQL) => {
	await sql.unsafe(`drop table if exists users;`).run();
};

export const allDataTypesUnsafeTest = async (sql: OpSqliteSQL) => {
	// console.log('1');
	await dropAllDataTypesTable(sql);
	// console.log('2');
	await createAllDataTypesTable(sql);
	// console.log('3');
	const values = [
		2147483647,
		// TODO: change to BigInt('9007199254740992') + BigInt(1) when op-sqlite supports BigInt
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
	// console.log('31');
	await sql.unsafe(
		`insert into all_data_types values (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		values,
	);

	// console.log('4');

	const res = await sql.unsafe(
		`select * from all_data_types;`,
	);
	// console.log('sql.unsafe:', res[0]);
	// console.log('5');
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

	// console.log('6');
	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();
	// console.log('10---------', arrayResult[0]);
	expect(arrayResult[0]).deep.equal(Object.values(expectedRes));
};

export const allDataTypesSqlValuesTest = async (sql: OpSqliteSQL) => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const values = [
		2147483647,
		// TODO: change to BigInt('9007199254740992') + BigInt(1) when op-sqlite supports BigInt
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

	const query = sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([values])};`.run();
	// console.log('2');
	// console.log(query.toSQL());
	// console.log('3');
	await query;
	// console.log('4');

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();

	// console.log(res[0]);
	expect(res[0]).deep.equal(expectedRes);
};

export const sqlQueryApiTest = async (sql: OpSqliteSQL) => {
	const filter = sqlQuery`id = ${1} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).deep.equal({
		query: 'select * from "users" where id = ? or id = ? and email = ?',
		params: [1, 2, 'hello@test.com'],
	});
	expect(filter.toSQL()).deep.equal({
		sql: 'id = ? or id = ? and email = ?',
		params: [1, 2, 'hello@test.com'],
	});
};

export const embedingSQLQueryAndSQLTemplateTest = async (sql: OpSqliteSQL) => {
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
	expect(res1.length).not.equal(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	// console.log(query2.toSQL());
	// console.log(await query2);
	const res2 = await query2;
	expect(res2.length).not.equal(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${1}`};`;
	// console.log(query3.toSQL());
	const res3 = await query3;
	// console.log(res3);
	expect(res3.length).not.equal(0);

	await dropUsersTable(sql);
};

export const loggerTest = async (client: DB) => {
	const loggerQuery = 'select ?;';
	const loggerParams = [1];
	const loggerText = `Query: ${loggerQuery} -- params: ${JSON.stringify(loggerParams)}`;

	const logger = {
		logQuery: (query: string, params: unknown[]) => {
			expect(query).equal(loggerQuery);
			expect(params).deep.equal(loggerParams);
		},
	};

	let loggerSql = waddler({ client, config: { logger } });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, config: { logger: true } });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, config: { logger: false } });
	await loggerSql`select ${1};`;
};
