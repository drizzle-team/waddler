import type Docker from 'dockerode';
import type { Client } from 'gel';
import createClient, { DateDuration, Duration, LocalDate, LocalDateTime, LocalTime, RelativeDuration } from 'gel';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { waddler } from 'waddler/gel';
import { commonTests } from '../common.test.ts';
import { createGelDockerDB } from '../utils.ts';
import {
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	defaultValue,
	dropAllDataTypesTable,
} from './gel-core.ts';
import 'zx/globals';
import type { SQL } from 'waddler';
import { commonPgTests } from '../pg/pg-core.ts';

let gelContainer: Docker.Container;
let gelClient: Client;
let gelConnectionParams: {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
};
let gelConnectionString: string;
const tlsSecurity = 'insecure' as const;

let sql: SQL;
beforeAll(async () => {
	const dockerPayload = await createGelDockerDB();
	const sleep = 1000;
	let timeLeft = 40000;
	let connected = false;
	let lastError;

	gelContainer = dockerPayload.gelContainer;
	do {
		try {
			gelConnectionString = dockerPayload.connectionString;
			gelConnectionParams = dockerPayload.connectionParams;
			gelClient = createClient({ ...dockerPayload.connectionParams, tlsSecurity });

			// await gelClient.querySQL(`select 1;`);
			sql = waddler({ client: gelClient });
			connected = true;
			break;
		} catch (e) {
			lastError = e;
			await new Promise((resolve) => setTimeout(resolve, sleep));
			timeLeft -= sleep;
		}
	} while (timeLeft > 0);
	if (!connected) {
		console.error('Cannot connect to Gel');
		await gelClient?.close().catch(console.error);
		await gelContainer?.stop().catch(console.error);
		throw lastError;
	}
});

afterAll(async () => {
	await gelClient?.close().catch(console.error);
	await gelContainer?.stop().catch(console.error);
});

beforeEach<{ sql: SQL }>((ctx) => {
	ctx.sql = sql;
});

commonTests();
commonPgTests();

test('connection test', async () => {
	const client = createClient({ ...gelConnectionParams, tlsSecurity: 'insecure' });
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	await client.close();

	const sql2 = waddler({ connection: { ...gelConnectionParams, tlsSecurity: 'insecure' } });
	await sql2`select 2;`;

	const sql21 = waddler({ connection: { dsn: gelConnectionString, tlsSecurity: 'insecure' } });
	await sql21`select 21;`;

	// const sql22 = waddler(gelConnectionString);
	// await sql22`select 22;`;
});

// UNSAFE-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(gelConnectionString, tlsSecurity).catch(() => {});
	await createAllDataTypesTable(gelConnectionString, tlsSecurity);

	const values = [
		'qwerty',
		true,
		32767,
		2147483647,
		9007199254740991,
		10.123,
		100.123,
		BigInt('9007199254740992') + BigInt(1),
		'1.123',
		'550e8400-e29b-41d4-a716-446655440000',
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		new Date('2024-10-31T14:25:29.425Z'),
		new LocalDateTime(2024, 10, 31, 14, 25, 29, 425), // new Date('2024-10-31T14:25:29.425Z'),
		new LocalDate(2024, 10, 31), // new Date('2024-10-31T14:25:29.425Z'),
		new LocalTime(14, 25, 29), // '14:25:29',
		new Duration(0, 0, 0, 0, 0, 0, 45, 6),
		new RelativeDuration(1, 2, 3, 4),
		new DateDuration(1, 2, 3, 4),
		Buffer.from('qwerty'),
	];

	// TODO: revise: do I need to add options to waddler like: allowUserSpecifiedId, disallowUserSpecifiedId
	// "await client.execute(`CONFIGURE SESSION SET allow_user_specified_id := true;`);"
	// I think(not sure) doing so will affect numbering of positional parameters, causing the first parameter to start at $0 instead of $1 as it does now.
	await sql.unsafe(
		`insert into "all_data_types" ("stringColumn","boolColumn","int16Column","int32Column","int64Column","float32Column","float64Column","bigintColumn","decimalColumn","uuidColumn","jsonColumn","datetimeColumn","local_datetimeColumn","local_dateColumn","local_timeColumn","durationColumn","relative_durationColumn","dateDurationColumn","bytesColumn","defaultValue") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, default);`,
		values,
		{ rowMode: 'object' },
	);

	const res = await sql.unsafe(
		`select "stringColumn","boolColumn","int16Column","int32Column","int64Column","float32Column","float64Column","bigintColumn","decimalColumn","uuidColumn","jsonColumn","datetimeColumn","local_datetimeColumn","local_dateColumn","local_timeColumn","durationColumn","relative_durationColumn","dateDurationColumn","bytesColumn","defaultValue" from all_data_types;`,
		[],
		{ rowMode: 'object' },
	);

	const expectedRes = {
		stringColumn: 'qwerty',
		boolColumn: true,
		int16Column: 32767,
		int32Column: 2147483647,
		int64Column: 9007199254740991,
		float32Column: 10.123000144958496,
		float64Column: 100.123,
		bigintColumn: '9007199254740993',
		decimalColumn: '1.123',
		uuidColumn: '550e8400-e29b-41d4-a716-446655440000',
		jsonColumn: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		datetimeColumn: new Date('2024-10-31T14:25:29.425Z'),
		local_datetimeColumn: new LocalDateTime(2024, 10, 31, 14, 25, 29, 425), // new Date('2024-10-31T14:25:29.425Z'),
		local_dateColumn: new LocalDate(2024, 10, 31), // new Date('2024-10-31T14:25:29.425Z'),
		local_timeColumn: new LocalTime(14, 25, 29), // '14:25:29',
		durationColumn: new RelativeDuration(0, 0, 0, 0, 0, 0, 45, 6),
		relative_durationColumn: new RelativeDuration(1, 2, 3, 4),
		dateDurationColumn: new RelativeDuration(1, 2, 3, 4),
		bytesColumn: new Uint8Array(Buffer.from('qwerty')),
		defaultValue: 3,
	};

	expect(res[0]).toStrictEqual(expectedRes);

	// same as select query as above but with rowMode: "array"
	const arrayResult = await sql.unsafe(
		`select "stringColumn","boolColumn","int16Column","int32Column","int64Column","float32Column","float64Column","bigintColumn","decimalColumn","uuidColumn","jsonColumn","datetimeColumn","local_datetimeColumn","local_dateColumn","local_timeColumn","durationColumn","relative_durationColumn","dateDurationColumn","bytesColumn","defaultValue" from all_data_types;`,
		[],
		{ rowMode: 'array' },
	);
	expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
});

// sql.values
// ALL TYPES-------------------------------------------------------------------
test('all types in sql.values, sql.raw in select test', async () => {
	await dropAllDataTypesTable(gelConnectionString, tlsSecurity).catch(() => {});
	await createAllDataTypesTable(gelConnectionString, tlsSecurity);

	const allDataTypesValues = [
		'qwerty',
		true,
		32767,
		2147483647,
		9007199254740991,
		10.123,
		100.123,
		BigInt('9007199254740992') + BigInt(1),
		'1.123',
		'550e8400-e29b-41d4-a716-446655440000',
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		new Date('2024-10-31T14:25:29.425Z'),
		new LocalDateTime(2024, 10, 31, 14, 25, 29, 425), // new Date('2024-10-31T14:25:29.425Z'),
		new LocalDate(2024, 10, 31), // new Date('2024-10-31T14:25:29.425Z'),
		new LocalTime(14, 25, 29), // '14:25:29',
		new Duration(0, 0, 0, 0, 0, 0, 45, 6),
		new RelativeDuration(1, 2, 3, 4),
		new DateDuration(1, 2, 3, 4),
		Buffer.from('qwerty'),
		sql.default,
	];

	const expectedRes = [
		'qwerty',
		true,
		32767,
		2147483647,
		9007199254740991,
		10.123000144958496,
		100.123,
		'9007199254740993',
		'1.123',
		'550e8400-e29b-41d4-a716-446655440000',
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		new Date('2024-10-31T14:25:29.425Z'),
		new LocalDateTime(2024, 10, 31, 14, 25, 29, 425), // new Date('2024-10-31T14:25:29.425Z'),
		new LocalDate(2024, 10, 31), // new Date('2024-10-31T14:25:29.425Z'),
		new LocalTime(14, 25, 29), // '14:25:29',
		new RelativeDuration(0, 0, 0, 0, 0, 0, 45, 6),
		new RelativeDuration(1, 2, 3, 4),
		new RelativeDuration(1, 2, 3, 4),
		new Uint8Array(Buffer.from('qwerty')),
		defaultValue,
	];

	const tableNames = [
		'stringColumn',
		'boolColumn',
		'int16Column',
		'int32Column',
		'int64Column',
		'float32Column',
		'float64Column',
		'bigintColumn',
		'decimalColumn',
		'uuidColumn',
		'jsonColumn',
		'datetimeColumn',
		'local_datetimeColumn',
		'local_dateColumn',
		'local_timeColumn',
		'durationColumn',
		'relative_durationColumn',
		'dateDurationColumn',
		'bytesColumn',
		'defaultValue',
	];
	await sql`insert into ${sql.identifier('all_data_types')} (${sql.identifier(tableNames)}) values ${
		sql.values([allDataTypesValues])
	};`;

	const res = await sql.unsafe(
		`select "stringColumn","boolColumn","int16Column","int32Column","int64Column","float32Column","float64Column","bigintColumn","decimalColumn","uuidColumn","jsonColumn","datetimeColumn","local_datetimeColumn","local_dateColumn","local_timeColumn","durationColumn","relative_durationColumn","dateDurationColumn","bytesColumn","defaultValue" from all_data_types;`,
		[],
		{ rowMode: 'array' },
	);

	expect(res[0]).toStrictEqual(expectedRes);
});

test('all array types in sql.values test', async () => {
	await createAllArrayDataTypesTable(gelConnectionString, tlsSecurity);

	const allArrayDataTypesValues = [
		['qwerty'],
		[true],
		[32767],
		[2147483647],
		[9007199254740991],
		[10.123],
		[100.123],
		[BigInt('9007199254740992') + BigInt(1)],
		['1.123'],
		['550e8400-e29b-41d4-a716-446655440000'],
		[{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}],
		[new Date('2024-10-31T14:25:29.425Z')],
		[new LocalDateTime(2024, 10, 31, 14, 25, 29, 425)], // new Date('2024-10-31T14:25:29.425Z')
		[new LocalDate(2024, 10, 31)], // new Date('2024-10-31T14:25:29.425Z')
		[new LocalTime(14, 25, 29)], // '14:25:29'
		[new Duration(0, 0, 0, 0, 0, 0, 45, 6)],
		[new RelativeDuration(1, 2, 3, 4)],
		[new DateDuration(1, 2, 3, 4)],
		[Buffer.from('qwerty')],
	];

	const expectedRes = [
		['qwerty'],
		[true],
		[32767],
		[2147483647],
		[9007199254740991],
		[10.123000144958496],
		[100.123],
		[BigInt('9007199254740993')],
		['1.123'],
		['550e8400-e29b-41d4-a716-446655440000'],
		[{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}],
		[new Date('2024-10-31T14:25:29.425Z')],
		[new LocalDateTime(2024, 10, 31, 14, 25, 29, 425)],
		[new LocalDate(2024, 10, 31)],
		[new LocalTime(14, 25, 29)],
		[new Duration(0, 0, 0, 0, 0, 0, 45, 6)],
		[new RelativeDuration(1, 2, 3, 4)],
		[new DateDuration(1, 2, 3, 4)],
		[new Uint8Array(Buffer.from('qwerty'))],
	];
	const columnNames = [
		'stringArrayColumn',
		'boolArrayColumn',
		'int16ArrayColumn',
		'int32ArrayColumn',
		'int64ArrayColumn',
		'float32ArrayColumn',
		'float64ArrayColumn',
		'bigintArrayColumn',
		'decimalArrayColumn',
		'uuidArrayColumn',
		'jsonArrayColumn',
		'datetimeArrayColumn',
		'local_datetimeArrayColumn',
		'local_dateArrayColumn',
		'local_timeArrayColumn',
		'durationArrayColumn',
		'relative_durationArrayColumn',
		'dateDurationArrayColumn',
		'bytesArrayColumn',
	];

	const query = sql`insert into ${sql.identifier('all_array_data_types')} (${sql.identifier(columnNames)}) values ${
		sql.values([allArrayDataTypesValues])
	};`;
	// const query = sql.unsafe(
	// 	`insert into all_array_data_types ("stringArrayColumn","boolArrayColumn","int16ArrayColumn","int32ArrayColumn","int64ArrayColumn","float32ArrayColumn","float64ArrayColumn","bigintArrayColumn","decimalArrayColumn","uuidArrayColumn","jsonArrayColumn","datetimeArrayColumn","local_datetimeArrayColumn","local_dateArrayColumn","local_timeArrayColumn","durationArrayColumn","relative_durationArrayColumn","dateDurationArrayColumn","bytesArrayColumn") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19);`,
	// 	allArrayDataTypesValues,
	// );
	// console.log(query.toSQL());
	await query;

	const res = await sql.unsafe(
		`select "stringArrayColumn","boolArrayColumn","int16ArrayColumn","int32ArrayColumn","int64ArrayColumn","float32ArrayColumn","float64ArrayColumn","bigintArrayColumn","decimalArrayColumn","uuidArrayColumn","jsonArrayColumn","datetimeArrayColumn","local_datetimeArrayColumn","local_dateArrayColumn","local_timeArrayColumn","durationArrayColumn","relative_durationArrayColumn","dateDurationArrayColumn","bytesArrayColumn" from all_array_data_types;`,
		[],
		{ rowMode: 'array' },
	);

	expect(res[0]).toStrictEqual(expectedRes);
});

// test('all nd-array types in sql.values test', async () => {
// 	await createAllNdarrayDataTypesTable(gelConnectionString, tlsSecurity);

// 	const json = {
// 		name: 'alex',
// 		age: 26,
// 		bookIds: [1, 2, 3],
// 		vacationRate: 2.5,
// 		aliases: ['sasha', 'sanya'],
// 		isMarried: true,
// 	};
// 	const allArrayDataTypesValues = [
// 		[['qwerty'], ['qwerty']],
// 		[[true], [true]],
// 		[[32767], [32767]],
// 		[[2147483647], [2147483647]],
// 		[[9007199254740991], [9007199254740991]],
// 		[[10.123], [10.123]],
// 		[[100.123], [100.123]],
// 		[[BigInt('9007199254740992') + BigInt(1)], [BigInt('9007199254740992') + BigInt(1)]],
// 		[['1.123'], ['1.123']],
// 		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
// 		[[json], [json]],
// 		[[new Date('2024-10-31T14:25:29.425Z')], [new Date('2024-10-31T14:25:29.425Z')]],
// 		[[new LocalDateTime(2024, 10, 31, 14, 25, 29, 425)], [new LocalDateTime(2024, 10, 31, 14, 25, 29, 425)]], // new Date('2024-10-31T14:25:29.425Z')
// 		[[new LocalDate(2024, 10, 31)], [new LocalDate(2024, 10, 31)]], // new Date('2024-10-31T14:25:29.425Z')
// 		[[new LocalTime(14, 25, 29)], [new LocalTime(14, 25, 29)]], // '14:25:29'
// 		[[new Duration(0, 0, 0, 0, 0, 0, 45, 6)], [new Duration(0, 0, 0, 0, 0, 0, 45, 6)]],
// 		[[new RelativeDuration(1, 2, 3, 4)], [new RelativeDuration(1, 2, 3, 4)]],
// 		[[new DateDuration(1, 2, 3, 4)], [new DateDuration(1, 2, 3, 4)]],
// 		[[Buffer.from('qwerty')], [Buffer.from('qwerty')]],
// 	];

// 	const expectedRes1 = [
// 		[['qwerty'], ['qwerty']],
// 		[[true], [true]],
// 		[[32767], [32767]],
// 		[[2147483647], [2147483647]],
// 		[[9007199254740991], [9007199254740991]],
// 		[[10.123000144958496], [10.123000144958496]],
// 		[[100.123], [100.123]],
// 		[[BigInt('9007199254740993')], [BigInt('9007199254740993')]],
// 		[['1.123'], ['1.123']],
// 		[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
// 		[[json], [json]],
// 		[[new Date('2024-10-31T14:25:29.425Z')], [new Date('2024-10-31T14:25:29.425Z')]],
// 		[[new LocalDateTime(2024, 10, 31, 14, 25, 29, 425)], [new LocalDateTime(2024, 10, 31, 14, 25, 29, 425)]],
// 		[[new LocalDate(2024, 10, 31)], [new LocalDate(2024, 10, 31)]],
// 		[[new LocalTime(14, 25, 29)], [new LocalTime(14, 25, 29)]],
// 		[[new Duration(0, 0, 0, 0, 0, 0, 45, 6)], [new Duration(0, 0, 0, 0, 0, 0, 45, 6)]],
// 		[[new RelativeDuration(1, 2, 3, 4)], [new RelativeDuration(1, 2, 3, 4)]],
// 		[[new DateDuration(1, 2, 3, 4)], [new DateDuration(1, 2, 3, 4)]],
// 		[[new Uint8Array(Buffer.from('qwerty'))], [new Uint8Array(Buffer.from('qwerty'))]],
// 	];

// 	const columnNames = [
// 		'stringNdArrayColumn',
// 		'boolNdArrayColumn',
// 		'int16NdArrayColumn',
// 		'int32NdArrayColumn',
// 		'int64NdArrayColumn',
// 		'float32NdArrayColumn',
// 		'float64NdArrayColumn',
// 		'bigintNdArrayColumn',
// 		'decimalNdArrayColumn',
// 		'uuidNdArrayColumn',
// 		'jsonNdArrayColumn',
// 		'datetimeNdArrayColumn',
// 		'local_datetimeNdArrayColumn',
// 		'local_dateNdArrayColumn',
// 		'local_timeNdArrayColumn',
// 		'durationNdArrayColumn',
// 		'relative_durationNdArrayColumn',
// 		'dateDurationNdArrayColumn',
// 		'bytesNdArrayColumn',
// 	];

// 	await sql`insert into ${sql.identifier('all_nd_array_data_types')} (${sql.identifier(columnNames)}) values ${
// 		sql.values([allArrayDataTypesValues])
// 	};`;

// 	const res = await sql.unsafe(
// 		`select "stringNdArrayColumn","boolNdArrayColumn","int16NdArrayColumn","int32NdArrayColumn","int64NdArrayColumn","float32NdArrayColumn","float64NdArrayColumn","bigintNdArrayColumn","decimalNdArrayColumn","uuidNdArrayColumn","jsonNdArrayColumn","datetimeNdArrayColumn","local_datetimeNdArrayColumn","local_dateNdArrayColumn","local_timeNdArrayColumn","durationNdArrayColumn","relative_durationNdArrayColumn","dateDurationNdArrayColumn","bytesNdArrayColumn" from all_nd_array_data_types;`,
// 		[],
// 		{ rowMode: 'array' },
// 	);

// 	expect(res[0]).toStrictEqual(expectedRes1);
// });

// sql.stream: not implemented yet
