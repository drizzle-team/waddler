import 'dotenv/config';

import retry from 'async-retry';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import type { SQL } from 'waddler';
import type { XataHttpClient } from 'waddler/xata-http';
import { waddler } from 'waddler/xata-http';
import { commonTests } from '../../common.test.ts';
import { vitestExpectSoftDate } from '../../utils.ts';
import {
	commonPgTests,
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	createAllNdarrayDataTypesTable,
	defaultValue,
	dropAllArrayDataTypesTable,
	dropAllDataTypesTable,
	dropAllNdarrayDataTypesTable,
} from '../pg-core.ts';
import { getXataClient } from '../xata/xata.ts';

let pgClient: XataHttpClient;

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	const apiKey = process.env['XATA_API_KEY'];
	if (!apiKey) {
		throw new Error('XATA_API_KEY is not defined');
	}

	pgClient = await retry(async () => {
		pgClient = getXataClient();
		return pgClient;
	}, {
		retries: 20,
		factor: 1,
		minTimeout: 250,
		maxTimeout: 250,
		randomize: false,
	});
	sql = waddler({ client: pgClient });
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

afterAll(async () => {
	await dropAllDataTypesTable(sql);
	await dropAllArrayDataTypesTable(sql);
	await dropAllNdarrayDataTypesTable(sql);
});

commonTests();
commonPgTests();

// There is no need for a connection test because the only connection setup is already handled in the beforeAll function.
// test('connection test', async () => {});

const encodeBufferForXata = (buffer: Buffer): string => {
	const jsonStr = JSON.stringify(buffer); // → {"type":"Buffer","data":[...]}
	const hex = Buffer.from(jsonStr, 'utf8').toString('hex');
	return `\\x${hex}`;
};

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425');
	const values = [
		1,
		10,
		BigInt('9007199254740992') + BigInt(1),
		1,
		10,
		BigInt('9007199254740992') + BigInt(1),
		true,
		'qwerty',
		'qwerty',
		'qwerty',
		'20.4',
		20.4,
		20.4,
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		'14:25:29.425',
		date,
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		Buffer.from('qwerty'),
		// sql.default,
	];

	await sql.unsafe(
		`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, default);`,
		values,
		{ rowMode: 'object' },
	);

	const res = await sql.unsafe(`select * from all_data_types;`);

	const dateWithoutTime = new Date(date);
	dateWithoutTime.setUTCHours(0, 0, 0, 0);
	const expectedRes = {
		integer: 1,
		smallint: 10,
		bigint: 9007199254740992, // should be BigInt('9007199254740992') + BigInt(1),
		serial: 1,
		smallserial: 10,
		bigserial: 9007199254740992, // should be BigInt('9007199254740992') + BigInt(1),
		boolean: true,
		text: 'qwerty',
		varchar: 'qwerty',
		char: 'qwerty',
		numeric: 20.4,
		real: 20.4,
		double_precision: 20.4,
		json: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		jsonb: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		time: '14:25:29.425',
		timestamp_date: '2024-10-31 12:25:29.425',
		date: '2024-10-31',
		interval: '1 day',
		point: '(1,2)', // [1, 2]
		line: '{1,2,3}', // [1, 2, 3]
		mood_enum: `no,'"\`rm`,
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		bytea: encodeBufferForXata(Buffer.from('qwerty')),
		default: defaultValue,
	} as Record<string, any>;

	expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
	let predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
		vitestExpectSoftDate(colValue, expectedRes[colName])
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
	expect(Object.keys(arrayResult[0]!).length).toBe(Object.keys(expectedRes).length);
	predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(arrayResult[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425Z');
	const allDataTypesValues = [
		1,
		10,
		BigInt('9007199254740992') + BigInt(1),
		1,
		10,
		BigInt('9007199254740992') + BigInt(1),
		true,
		'qwerty',
		'qwerty',
		'qwerty',
		'20.4',
		20.4,
		20.4,
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		'14:25:29.425',
		date,
		'2024-10-31',
		'1 day',
		'(1,2)',
		'{1,2,3}',
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		Buffer.from('qwerty'),
		sql.default,
	];

	const expectedRes = [
		1,
		10,
		9007199254740992, // should be BigInt('9007199254740992') + BigInt(1),
		1,
		10,
		9007199254740992, // should be BigInt('9007199254740992') + BigInt(1),
		true,
		'qwerty',
		'qwerty',
		'qwerty',
		20.4,
		20.4,
		20.4,
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		{ name: 'alex', age: 26, bookIds: [1, 2, 3], vacationRate: 2.5, aliases: ['sasha', 'sanya'], isMarried: true },
		'14:25:29.425',
		'2024-10-31 14:25:29.425',
		'2024-10-31',
		'1 day',
		'(1,2)', // [1, 2],
		'{1,2,3}', // [1, 2, 3],
		`no,'"\`rm`,
		'550e8400-e29b-41d4-a716-446655440000',
		encodeBufferForXata(Buffer.from('qwerty')),
		defaultValue,
	];

	await sql`insert into ${sql.identifier('all_data_types')} values ${sql.values([allDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);
});

test('all array types in sql.values test', async () => {
	await createAllArrayDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425Z');

	const allArrayDataTypesValues = [
		[1],
		[10],
		[String(BigInt('9007199254740992') + BigInt(1))],
		[true],
		['qwerty'],
		['qwerty'],
		['qwerty'],
		[20.4],
		[20.4],
		[20.4],
		[
			JSON.stringify({
				name: 'alex',
				age: 26,
				bookIds: [1, 2, 3],
				vacationRate: 2.5,
				aliases: ['sasha', 'sanya'],
				isMarried: true,
			}),
		],
		[
			JSON.stringify({
				name: 'alex',
				age: 26,
				bookIds: [1, 2, 3],
				vacationRate: 2.5,
				aliases: ['sasha', 'sanya'],
				isMarried: true,
			}),
		],
		['14:25:29.425'],
		[date],
		['2024-10-31'],
		['1 days'],
		['(1,2)'],
		['{1.1,2,3}', '{4.4,5,6}'],
		['ok', 'happy', `no,'"\`rm`],
		['550e8400-e29b-41d4-a716-446655440000'],
	];

	const expectedRes = [
		[1],
		[10],
		[9007199254740992], // should be [BigInt('9007199254740992') + BigInt(1),]
		[true],
		['qwerty'],
		['qwerty'],
		['qwerty'],
		[20.4],
		[20.4],
		[20.4],
		null, // TODO revise: xata returns null for json[] and jsonb[] even though db has values for these columns;
		// TODO create issue on https://github.com/xataio/client-ts and add it here.
		null,
		// [{
		// 	name: 'alex',
		// 	age: 26,
		// 	bookIds: [1, 2, 3],
		// 	vacationRate: 2.5,
		// 	aliases: ['sasha', 'sanya'],
		// 	isMarried: true,
		// }],
		// [{
		// 	name: 'alex',
		// 	age: 26,
		// 	bookIds: [1, 2, 3],
		// 	vacationRate: 2.5,
		// 	aliases: ['sasha', 'sanya'],
		// 	isMarried: true,
		// }],
		'{14:25:29.425}',
		['2024-10-31 14:25:29.425+00'],
		['2024-10-31'],
		['1 day'], // ['1 day'],
		['(1,2)'], // [[1, 2]],
		['{1.1,2,3}', '{4.4,5,6}'], // [[1.1, 2, 3], [4.4, 5, 6]], // ['{1.1,2,3}', '{4.4,5,6}'],
		'{ok,happy,"no,\'\\"`rm"}', // ['ok', 'happy', `no,'"\`rm`],
		'{550e8400-e29b-41d4-a716-446655440000}',
	];

	await sql`insert into ${sql.identifier('all_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes1);
});

test('all nd-array types in sql.values test', async () => {
	await createAllNdarrayDataTypesTable(sql);

	const date = new Date('2024-10-31T14:25:29.425Z');

	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};
	const allArrayDataTypesValues = [
		[[1, 2], [2, 3]],
		[[json], [json]],
		[[json], [json]],
		[['14:25:29.425'], ['14:25:29.425']],
		[[date], [date]],
		[['2024-10-31'], ['2024-10-31']],
		[['1 days'], ['1 days']],
		[['(1,2)'], ['(1,2)']],
		[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']],
		[['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
	];

	const expectedRes = [
		[[1, 2], [2, 3]],
		[null, null], // TODO revise: xata returns null for json[] and jsonb[] even though db has values for these columns
		[null, null],
		'{{14:25:29.425},{14:25:29.425}}',
		[['2024-10-31 14:25:29.425+00'], ['2024-10-31 14:25:29.425+00']],
		[['2024-10-31'], ['2024-10-31']],
		[['1 day'], ['1 day']], // [['1 days'], ['1 days']]
		[['(1,2)'], ['(1,2)']], // [[[1, 2]], [[1, 2]]],
		[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']], // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]],
		'{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}', // [['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
		'{{550e8400-e29b-41d4-a716-446655440000},{550e8400-e29b-41d4-a716-446655440000}}',
	];

	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${sql.values([allArrayDataTypesValues])};`;

	const res = await sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes1);
});

// sql.stream
// not implemented yet
