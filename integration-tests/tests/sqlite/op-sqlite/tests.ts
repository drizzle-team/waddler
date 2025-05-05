// This file serves only as a reference for what and how I'm testing in a detached project.
import { Buffer } from 'buffer';
import { expect } from 'chai';
import type { OpSqliteSQL } from 'waddler/op-sqlite';

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
