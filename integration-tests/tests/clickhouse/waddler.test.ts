import { type ClickHouseClient, createClient, TupleParam } from '@clickhouse/client';
import type Docker from 'dockerode';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { ClickHouseSQL } from 'waddler/clickhouse';
import { sql as sqlQuery, waddler } from 'waddler/clickhouse';
import { commonTests } from '../common.test.ts';
import { createClickHouseDockerDB, vitestExpectSoftDate } from '../utils.ts';
import {
	commonClickHouseTests,
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	createAllNdarrayDataTypesTable,
	defaultValue,
	dropAllArrayDataTypesTable,
	dropAllDataTypesTable,
	dropAllNdarrayDataTypesTable,
} from './clickhouse-core.ts';
import { filter1 } from './test-filters1.ts';
import { filter2 } from './test-filters2.ts';

let clickHouseContainer: Docker.Container;
let clickHouseClient: ClickHouseClient;
let clickHouseConnectionParams: {
	url: string;
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
};

let sql: ReturnType<typeof waddler>;
beforeAll(async () => {
	const dockerPayload = await createClickHouseDockerDB();
	const sleep = 1000;
	let timeLeft = 40000;
	let connected = false;
	let lastError;

	clickHouseContainer = dockerPayload.clickHouseContainer;
	do {
		try {
			clickHouseConnectionParams = dockerPayload.connectionParams;
			const { host: _, port: __, ...filteredParams } = clickHouseConnectionParams;
			clickHouseClient = createClient({
				clickhouse_settings: {},
				...filteredParams,
			});
			const res = await clickHouseClient.ping();
			if (!res.success) throw new Error('Cannot connect to ClickHouse. Retrying.');
			sql = waddler({ client: clickHouseClient });
			connected = true;
			break;
		} catch (e) {
			lastError = e;
			await new Promise((resolve) => setTimeout(resolve, sleep));
			timeLeft -= sleep;
		}
	} while (timeLeft > 0);
	if (!connected) {
		console.error('Cannot connect to ClickHouse');
		await clickHouseClient?.close().catch(console.error);
		await clickHouseContainer?.stop().catch(console.error);
		throw lastError;
	}
});

afterAll(async () => {
	await clickHouseClient?.close().catch(console.error);
	await clickHouseContainer?.stop().catch(console.error);
});

beforeEach<{ sql: ClickHouseSQL }>((ctx) => {
	ctx.sql = sql;
});

test('connection test', async () => {
	const { host: _, port: __, ...filteredParams } = clickHouseConnectionParams;
	const client = createClient(filteredParams);
	const sql1 = waddler({ client });
	await sql1`select 1;`;

	await client.close();

	const sql2 = waddler({ connection: filteredParams });
	await sql2`select 2;`;

	const url =
		`http://${clickHouseConnectionParams.user}:${clickHouseConnectionParams.password}@${clickHouseConnectionParams.host}:${clickHouseConnectionParams.port}/${clickHouseConnectionParams.database}`;
	const sql21 = waddler({ connection: url });
	await sql21`select 21;`;

	const sql22 = waddler(url);
	await sql22`select 22;`;

	const sql23 = waddler({ connection: { url } });
	await sql23`select 23;`;
});

commonTests('clickhouse');
commonClickHouseTests();

// ALL TYPES with sql.unsafe and sql.values-------------------------------------------------------------------
test('all types in sql.unsafe test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const allDataTypesValues = Object.fromEntries([
		127, // int8
		32767, // int16
		2147483647, // int32
		'9223372036854775807', // int64 ; TODO revise: seems like driver does not support BigInt type
		'170141183460469231731687303715884105727', // int128
		'57896044618658097711785492504343953926634992332820282019728792003956564819967', // int256
		255, // uint8
		65535, // uint16
		4294967295, // uint32
		'18446744073709551615', // uint64
		'340282366920938463463374607431768211455', // uint128
		'115792089237316195423570985008687907853269984665640564039457584007913129639935', // uint256
		10.123, // float32
		100.123456, // float32
		1.123, // bfloat16
		10.23, // decimal32(7) P from [ 1 : 9 ]
		100.23, // decimal64(15) P from [ 10 : 18 ]
		1000.23, // decimal128(34) P from [ 19 : 38 ]
		10000.23, // decimal256(71) P from [ 39 : 76 ]
		'qwerty', // string
		'qwerty1234', // string(10)
		'2024-10-31', // date ; TODO revise: seems like driver does not support Date type
		'2024-10-31', // date32 '2024-10-31'
		new Date('2024-10-31T14:25:29'), // datetime
		new Date('2024-10-31T14:25:29.123'), // datetime64
		'hello', // enum('hello', 'world')
		'61f0c404-5cb3-11e7-907b-a6006ad3dba0', // uuid
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}), // json
		'116.253.40.133', // ipv4
		'2a02:aa08:e000:3100::2', // ipv6
		true, // bool
		'qwerty', // Variant(UInt8, String)
		'qwerty', // LowCardinality(String)
		null, // Nullable(String) TODO: revise: select returns empty string not a null
		'(10,-10)', // Point ; TODO: revise driver cannot handle node js array in client.command query_params;
		// Feature: add sql.toTuple, sql.toPoint function and similar
		'[(0,0),(10,0),(10,10),(0,10)]', // Ring
		'[(0,0),(10,0),(10,10),(0,10)]', // LineString
		'[[(0,0),(10,0),(10,10),(0,10)],[(1,1),(2,2),(3,3)]]', // MultiLineString
		'[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]', // Polygon
		'[[[(0,0),(10,0),(10,10),(0,10)]],[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]', // MultiPolygon
		"(0, 'a')", // Tuple(i UInt8, s String) ;
		{ key1: 1, key2: 10 }, // Map(String, UInt8)
		// 'qwerty', // Dynamic // TODO revise: can't insert dynamic using parameterized query
	].map((val, idx) => [`val${idx + 1}`, val]));

	await sql.unsafe(
		`
        insert into \`all_data_types\` values (
        {val1:String}, -- int8
        {val2:String}, -- int16
        {val3:String}, -- int32
        {val4:String}, -- int64
        {val5:String}, -- int128
        {val6:String}, -- int256
        {val7:String}, -- uint8
        {val8:String}, -- uint16
        {val9:String}, -- uint32
        {val10:String}, -- uint64
        {val11:String}, -- uint128
        {val12:String}, -- uint256
        {val13:String}, -- float32
        {val14:String}, -- float32
        {val15:String}, -- bfloat16
        {val16:String}, -- decimal32(9)
        {val17:String}, -- decimal64(18)
        {val18:String}, -- decimal128(38)
        {val19:String}, -- decimal256(76)
        {val20:String}, -- string
        {val21:String}, -- string(10)
        {val22:String}, -- date
        {val23:String}, -- date32
        {val24:String}, -- datetime
        {val25:String}, -- datetime64
        {val26:String}, -- enum('hello', 'world')
        {val27:String}, -- uuid
        {val28:JSON},   -- JSON
        {val29:String}, -- ipv4
        {val30:String}, -- ipv6
        {val31:String}, -- bool
        {val32:String}, -- Variant(UInt8, String)
        {val33:String}, -- LowCardinality(String)
        {val34:String}, -- Nullable(String)
        {val35:String}, -- Point
        {val36:String}, -- Ring
        {val37:String}, -- LineString
        {val38:String}, -- MultiLineString
        {val39:String}, -- Polygon
        {val40:String}, -- MultiPolygon
        {val41:String}, -- Tuple(i UInt8, s String)
        {val42:String}, -- Map(String, UInt8)
        'qwerty',
        default
        );
        `,
		allDataTypesValues,
	).command();

	const res = await sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'object' }).query();

	const expectedRes = {
		int8: 127,
		int16: 32767,
		int32: 2147483647,
		int64: '9223372036854775807',
		int128: '170141183460469231731687303715884105727',
		int256: '57896044618658097711785492504343953926634992332820282019728792003956564819967',
		uint8: 255,
		uint16: 65535,
		uint32: 4294967295,
		uint64: '18446744073709551615',
		uint128: '340282366920938463463374607431768211455',
		uint256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
		float32: 10.123,
		float64: 100.123456,
		bfloat16: 1.1171875,
		decimal32: 10.23,
		decimal64: 100.23,
		decimal128: 1000.23,
		decimal256: 10000.23,
		string: 'qwerty',
		fixed_string: 'qwerty1234',
		date: '2024-10-31',
		date32: '2024-10-31',
		date_time: '2024-10-31 12:25:29',
		date_time64: '2024-10-31 12:25:29.123',
		enum: 'hello',
		uuid: '61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		json: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		ipv4: '116.253.40.133',
		ipv6: '2a02:aa08:e000:3100::2',
		boolean: true,
		variant_uint8_string: 'qwerty',
		low_cardinality_string: 'qwerty',
		nullable_string: '',
		point: [10, -10],
		ring: [[0, 0], [10, 0], [10, 10], [0, 10]],
		line_string: [[0, 0], [10, 0], [10, 10], [0, 10]],
		multi_line_string: [
			[[0, 0], [10, 0], [10, 10], [0, 10]],
			[[1, 1], [2, 2], [3, 3]],
		],
		polygon: [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		],
		multi_polygon: [[[[0, 0], [10, 0], [10, 10], [0, 10]]], [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]],
		tuple_uint8_string: { i: 0, s: 'a' },
		map_string_uint8: { key1: 1, key2: 10 },
		dynamic: 'qwerty',
		default_int: defaultValue,
	} as Record<string, any>;

	expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
	let predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
		vitestExpectSoftDate(colValue, expectedRes[colName])
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);

	const arrayResult = await sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'array' }).query();

	expect(Object.keys(arrayResult[0]!).length).toBe(Object.keys(expectedRes).length);
	predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(arrayResult[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(resArray[0]).toStrictEqual(Object.values(expectedRes));
});

test('all types in sql.values test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const allDataTypesValues = [
		127, // int8
		32767, // int16
		2147483647, // int32
		'9223372036854775807', // int64 ; TODO revise: seems like driver does not support BigInt type
		'170141183460469231731687303715884105727', // int128
		'57896044618658097711785492504343953926634992332820282019728792003956564819967', // int256
		255, // uint8
		65535, // uint16
		4294967295, // uint32
		'18446744073709551615', // uint64
		'340282366920938463463374607431768211455', // uint128
		'115792089237316195423570985008687907853269984665640564039457584007913129639935', // uint256
		10.123, // float32
		100.123456, // float32
		1.123, // bfloat16
		10.23, // decimal32(7) P from [ 1 : 9 ]
		100.23, // decimal64(15) P from [ 10 : 18 ]
		1000.23, // decimal128(34) P from [ 19 : 38 ]
		10000.23, // decimal256(71) P from [ 39 : 76 ]
		`qwe'"rty`, // string
		`qwe'"rty12`, // string(10)
		'2024-10-31', // date ; TODO revise: seems like driver does not support Date type
		'2024-10-31', // date32 '2024-10-31'
		new Date('2024-10-31T14:25:29'), // datetime
		new Date('2024-10-31T14:25:29.123'), // datetime64
		'hello', // enum('hello', 'world')
		'61f0c404-5cb3-11e7-907b-a6006ad3dba0', // uuid
		{
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}, // json
		'116.253.40.133', // ipv4
		'2a02:aa08:e000:3100::2', // ipv6
		true, // bool
		'qwerty', // Variant(UInt8, String)
		'qwerty', // LowCardinality(String)
		null, // Nullable(String) TODO: revise: select returns empty string not a null
		'(10,-10)', // Point ; TODO: revise driver cannot handle node js array in client.command query_params;
		// Feature: add sql.toTuple, sql.toPoint function and similar
		'[(0,0),(10,0),(10,10),(0,10)]', // Ring
		'[(0,0),(10,0),(10,10),(0,10)]', // LineString
		'[[(0,0),(10,0),(10,10),(0,10)],[(1,1),(2,2),(3,3)]]', // MultiLineString
		'[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]', // Polygon
		'[[[(0,0),(10,0),(10,10),(0,10)]],[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]', // MultiPolygon
		new TupleParam([0, 'a']), // "(0, 'a')", // Tuple(i UInt8, s String) ;
		new Map([['key1', 1], ['key2', 10]]), // { key1: 1, key2: 10 }, // Map(String, UInt8)
		sql.raw("'qwerty'"), // Dynamic
		sql.default,
	];

	let types: string[] = [];
	await sql`insert into \`all_data_types\` values ${sql.values([allDataTypesValues], types)};`
		.command();

	const res = await sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'object' }).query();

	const expectedRes = {
		int8: 127,
		int16: 32767,
		int32: 2147483647,
		int64: '9223372036854775807',
		int128: '170141183460469231731687303715884105727',
		int256: '57896044618658097711785492504343953926634992332820282019728792003956564819967',
		uint8: 255,
		uint16: 65535,
		uint32: 4294967295,
		uint64: '18446744073709551615',
		uint128: '340282366920938463463374607431768211455',
		uint256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
		float32: 10.123,
		float64: 100.123456,
		bfloat16: 1.1171875,
		decimal32: 10.23,
		decimal64: 100.23,
		decimal128: 1000.23,
		decimal256: 10000.23,
		string: `qwe'"rty`,
		fixed_string: `qwe'"rty12`,
		date: '2024-10-31',
		date32: '2024-10-31',
		date_time: '2024-10-31 12:25:29',
		date_time64: '2024-10-31 12:25:29.123',
		enum: 'hello',
		uuid: '61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		json: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		ipv4: '116.253.40.133',
		ipv6: '2a02:aa08:e000:3100::2',
		boolean: true,
		variant_uint8_string: 'qwerty',
		low_cardinality_string: 'qwerty',
		nullable_string: '',
		point: [10, -10],
		ring: [[0, 0], [10, 0], [10, 10], [0, 10]],
		line_string: [[0, 0], [10, 0], [10, 10], [0, 10]],
		multi_line_string: [
			[[0, 0], [10, 0], [10, 10], [0, 10]],
			[[1, 1], [2, 2], [3, 3]],
		],
		polygon: [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		],
		multi_polygon: [[[[0, 0], [10, 0], [10, 10], [0, 10]]], [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]],
		tuple_uint8_string: { i: 0, s: 'a' },
		map_string_uint8: { key1: 1, key2: 10 },
		dynamic: 'qwerty',
		default_int: defaultValue,
	} as Record<string, any>;

	expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
	let predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
		vitestExpectSoftDate(colValue, expectedRes[colName])
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);

	const arrayResult = await sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'array' }).query();

	expect(Object.keys(arrayResult[0]!).length).toBe(Object.keys(expectedRes).length);
	predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(arrayResult[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);
	// expect(resArray[0]).toStrictEqual(Object.values(expectedRes));

	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	types = [
		'Int8',
		'Int16',
		'Int32',
		'Int64',
		'Int128',
		'Int256',
		'UInt8',
		'UInt16',
		'UInt32',
		'UInt64',
		'UInt128',
		'UInt256',
		'Float32',
		'Float64',
		'BFloat16',
		'Decimal32(7)',
		'Decimal64(15)',
		'Decimal128(34)',
		'Decimal256(71)',
		'String',
		'FixedString(10)',
		'Date',
		'Date32',
		'DateTime',
		'DateTime64',
		`Enum('hello', 'world')`,
		'UUID',
		'JSON',
		'IPv4',
		'IPv6',
		'BOOL',
		'Variant(UInt8, String)',
		'LowCardinality(String)',
		'Nullable(String)',
		'Point',
		'Ring',
		'LineString',
		'MultiLineString',
		'Polygon',
		'MultiPolygon',
		'Tuple(UInt8,String)',
		'Map(String, UInt8)',
	];

	await sql`insert into \`all_data_types\` values ${sql.values([allDataTypesValues], types)};`
		.command();

	await sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'object' }).query();
	// console.log(res1[0]);
});

test('all array types in sql.values test', async () => {
	await createAllArrayDataTypesTable(sql);

	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};
	const allArrayDataTypesValues = [
		[-1, 2, 127], // Array(Int8)
		[-4, 5, 32767], // Array(Int16)
		[-7, 8, 2147483647], // Array(Int32)
		[-10, 11, 9223372036854775807n], // Array(Int64)
		[-13, 14, 170141183460469231731687303715884105727n], // Array(Int128)
		[-16, 17, 57896044618658097711785492504343953926634992332820282019728792003956564819967n], // Array(Int256)
		[1, 2, 255], // Array(UInt8)
		[4, 5, 65535], // Array(UInt16)
		[7, 8, 4294967295], // Array(UInt32)
		[10, 11, 18446744073709551615n], // Array(UInt64)
		[13, 14, 340282366920938463463374607431768211455n], // Array(UInt128)
		[16, 17, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // Array(UInt256)
		[-1.234, 2.345], // Array(Float32)
		[-3.456, 4.567], // Array(Float64)
		[-0.6, 0.7], // Array(BFloat16)
		[0.123, -1.234], // Array(Decimal32(7))
		[1.234, -2.345], // Array(Decimal64(15))
		[3.456, -4.567], // Array(Decimal128(34))
		[5.678, -6.789], // Array(Decimal256(71))
		[`qwe'"rty1`, `qwe'"rty2`], // Array(String)
		[`qwe'"rty12`, `qwe'"rty23`], // Array(FixedString(10))
		['2024-10-31', '2024-11-31'], // Array(Date)
		['2024-10-30', '2024-11-30'], // Array(Date32)
		['2024-10-31 14:25:29', '2024-11-31 14:25:29'], // Array(DateTime)
		['2024-10-30 14:25:29.123', '2024-11-30 14:25:29.123'], // Array(DateTime64)
		['hello', 'world'], // Array(Enum('hello', 'world'))
		['61f0c404-5cb3-11e7-907b-a6006ad3dba0', '61f0c404-5cb3-11e7-907b-a6006ad3dba0'], // Array(UUID)
		[json, json], // Array(JSON)
		['116.253.40.133', '116.253.40.134'], // Array(IPv4)
		['2a02:aa08:e000:3100::2', '2a02:aa08:e000:3100::1'], // Array(IPv6)
		[true, false], // Array(BOOL)
		['qwerty', 1], // Array(Variant(UInt8, String))
		['qwerty1', 'qwerty2'], // Array(LowCardinality(String))
		[null, null], // Array(Nullable(String))
		'[(10,-10),(11,-11)]', // Array(Point)
		'[[(0,0),(10,0),(10,10),(0,10)]]', // Array(Ring)
		'[[(0,0),(10,0),(10,10),(0,10)]]', // Array(LineString)
		'[[[(0,0),(10,0),(10,10),(0,10)],[(1,1),(2,2),(3,3)]]]', // Array(MultiLineString)
		'[[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]', // Array(Polygon)
		'[[[[(0,0),(10,0),(10,10),(0,10)]],[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]]', // Array(MultiPolygon)
		[new TupleParam([1, 'a']), new TupleParam([2, 'b'])], // Array(Tuple(i UInt8, s String))
		[new Map([['key1', 1], ['key2', 10]]), new Map([['key1', 2], ['key2', 11]])], // Array(Map(String, UInt8))
		['qwerty', 'qwerty1'], // Array(Dynamic)
	];

	let types: string[] = [];

	const query = sql`insert into \`all_array_data_types\` values ${sql.values([allArrayDataTypesValues], types)};`
		.command();
	await query;
	// console.log(query.toSQL());

	const res = await sql.unsafe(`select * from \`all_array_data_types\`;`, [], { rowMode: 'object' }).query();

	const expectedRes = {
		int8_array: [-1, 2, 127],
		int16_array: [-4, 5, 32767],
		int32_array: [-7, 8, 2147483647],
		int64_array: ['-10', '11', '9223372036854775807'],
		int128_array: ['-13', '14', '170141183460469231731687303715884105727'],
		int256_array: [
			'-16',
			'17',
			'57896044618658097711785492504343953926634992332820282019728792003956564819967',
		],
		uint8_array: [1, 2, 255],
		uint16_array: [4, 5, 65535],
		uint32_array: [7, 8, 4294967295],
		uint64_array: ['10', '11', '18446744073709551615'],
		uint128_array: ['13', '14', '340282366920938463463374607431768211455'],
		uint256_array: [
			'16',
			'17',
			'115792089237316195423570985008687907853269984665640564039457584007913129639935',
		],
		float32_array: [-1.234, 2.345],
		float64_array: [-3.456, 4.567],
		bfloat16_array: [-0.59765625, 0.69921875],
		decimal32_array: [0.123, -1.234],
		decimal64_array: [1.234, -2.345],
		decimal128_array: [3.456, -4.567],
		decimal256_array: [5.678, -6.789],
		string_array: [`qwe'"rty1`, `qwe'"rty2`],
		fixed_string_array: [`qwe'"rty12`, `qwe'"rty23`],
		date_array: ['2024-10-31', '2024-12-01'],
		date32_array: ['2024-10-30', '2024-11-30'],
		date_time_array: ['2024-10-31 14:25:29', '2024-12-01 14:25:29'],
		date_time64_array: ['2024-10-30 14:25:29.123', '2024-11-30 14:25:29.123'],
		enum_array: ['hello', 'world'],
		uuid_array: [
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		],
		json_array: [json, json],
		ipv4_array: ['116.253.40.133', '116.253.40.134'],
		ipv6_array: ['2a02:aa08:e000:3100::2', '2a02:aa08:e000:3100::1'],
		boolean_array: [true, false],
		variant_uint8_string_array: ['qwerty', 1],
		low_cardinality_string_array: ['qwerty1', 'qwerty2'],
		nullable_string_array: [null, null],
		point_array: [[10, -10], [11, -11]],
		ring_array: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
		line_string_array: [[[0, 0], [10, 0], [10, 10], [0, 10]]],
		multi_line_string_array: [[
			[[0, 0], [10, 0], [10, 10], [0, 10]],
			[[1, 1], [2, 2], [3, 3]],
		]],
		polygon_array: [[
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]],
		multi_polygon_array: [[[[[0, 0], [10, 0], [10, 10], [0, 10]]], [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]]],
		tuple_uint8_string_array: [{ i: 1, s: 'a' }, { i: 2, s: 'b' }],
		map_string_uint8_array: [{ key1: 1, key2: 10 }, { key1: 2, key2: 11 }],
		dynamic_array: ['qwerty', 'qwerty1'],
	} as Record<string, any>;

	expect(Object.keys(res[0]!).length).toBe(Object.keys(expectedRes).length);
	const predicate = Object.entries(res[0] as Record<string, any>).every(([colName, colValue]) =>
		vitestExpectSoftDate(colValue, expectedRes[colName])
	);
	expect(predicate).toBe(true);
	// expect(res[0]).toStrictEqual(expectedRes);

	await dropAllArrayDataTypesTable(sql);
	await createAllArrayDataTypesTable(sql);

	types = [
		'Array(Int8)',
		'Array(Int16)',
		'Array(Int32)',
		'Array(Int64)',
		'Array(Int128)',
		'Array(Int256)',
		'Array(UInt8)',
		'Array(UInt16)',
		'Array(UInt32)',
		'Array(UInt64)',
		'Array(UInt128)',
		'Array(UInt256)',
		'Array(Float32)',
		'Array(Float64)',
		'Array(BFloat16)',
		'Array(Decimal32(7))',
		'Array(Decimal64(15))',
		'Array(Decimal128(34))',
		'Array(Decimal256(71))',
		'Array(String)',
		'Array(FixedString(10))',
		'Array(Date)',
		'Array(Date32)',
		'Array(DateTime)',
		'Array(DateTime64)',
		`Array(Enum('hello', 'world'))`,
		'Array(UUID)',
		'Array(JSON)',
		'Array(IPv4)',
		'Array(IPv6)',
		'Array(BOOL)',
		'String', // TODO: revise: cannot insert array with type case 'Array(Variant(UInt8, String))',
		'Array(LowCardinality(String))',
		'Array(Nullable(String))',
		'Array(Point)',
		'Array(Ring)',
		'Array(LineString)',
		'Array(MultiLineString)',
		'Array(Polygon)',
		'Array(MultiPolygon)',
		'Array(Tuple(UInt8,String))',
		'Array(Map(String, UInt8))',
	];

	await sql`insert into \`all_array_data_types\` values ${sql.values([allArrayDataTypesValues], types)};`
		.command();

	await sql.unsafe(`select * from \`all_array_data_types\`;`, [], { rowMode: 'object' }).query();
	// console.log(res1[0]);
});

test('all nd-array types in sql.values test', async () => {
	await createAllNdarrayDataTypesTable(sql);

	const json = {
		name: 'alex',
		age: 26,
		bookIds: [1, 2, 3],
		vacationRate: 2.5,
		aliases: ['sasha', 'sanya'],
		isMarried: true,
	};

	const allArrayDataTypesValues = [
		[[-1, 2, 127], [-1, 2, 127]], // Array(Array(Int8))
		[[-4, 5, 32767], [-4, 5, 32767]], // Array(Array(Int16))
		[[-7, 8, 2147483647], [-7, 8, 2147483647]], // Array(Array(Int32))
		[[-10, 11, 9223372036854775807n], [-10, 11, 9223372036854775807n]], // Array(Array(Int64))
		[[-13, 14, 170141183460469231731687303715884105727n], [-13, 14, 170141183460469231731687303715884105727n]], // Array(Array(Int128))
		[[-16, 17, 57896044618658097711785492504343953926634992332820282019728792003956564819967n], [
			-16,
			17,
			57896044618658097711785492504343953926634992332820282019728792003956564819967n,
		]], // Array(Array(Int256))
		[[1, 2, 255], [1, 2, 255]], // Array(Array(UInt8))
		[[4, 5, 65535], [4, 5, 65535]], // Array(Array(UInt16))
		[[7, 8, 4294967295], [7, 8, 4294967295]], // Array(Array(UInt32))
		[[10, 11, 18446744073709551615n], [10, 11, 18446744073709551615n]], // Array(Array(UInt64))
		[[13, 14, 340282366920938463463374607431768211455n], [13, 14, 340282366920938463463374607431768211455n]], // Array(Array(UInt128))
		[[16, 17, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], [
			16,
			17,
			115792089237316195423570985008687907853269984665640564039457584007913129639935n,
		]], // Array(Array(UInt256))
		[[-1.234, 2.345], [-1.234, 2.345]], // Array(Array(Float32))
		[[-3.456, 4.567], [-3.456, 4.567]], // Array(Array(Float64))
		[[-0.6, 0.7], [-0.6, 0.7]], // Array(Array(BFloat16))
		[[0.123, -1.234], [0.123, -1.234]], // Array(Array(Decimal32(7)))
		[[1.234, -2.345], [1.234, -2.345]], // Array(Array(Decimal64(15)))
		[[3.456, -4.567], [3.456, -4.567]], // Array(Array(Decimal128(34)))
		[[5.678, -6.789], [5.678, -6.789]], // Array(Array(Decimal256(71)))
		[['qwerty1', 'qwerty2'], ['qwerty1', 'qwerty2']], // Array(Array(String))
		[['qwerty1234', 'qwerty2345'], ['qwerty1234', 'qwerty2345']], // Array(Array(FixedString(10)))
		[['2024-10-31', '2024-11-31'], ['2024-10-31', '2024-11-31']], // Array(Array(Date))
		[['2024-10-30', '2024-11-30'], ['2024-10-30', '2024-11-30']], // Array(Array(Date32))
		[['2024-10-31 14:25:29', '2024-11-31 14:25:29'], ['2024-10-31 14:25:29', '2024-11-31 14:25:29']], // Array(Array(DateTime))
		[['2024-10-30 14:25:29.123', '2024-11-30 14:25:29.123'], ['2024-10-30 14:25:29.123', '2024-11-30 14:25:29.123']], // Array(Array(DateTime64))
		[['hello', 'world'], ['hello', 'world']], // Array(Array(Enum('hello', 'world')))
		[['61f0c404-5cb3-11e7-907b-a6006ad3dba0', '61f0c404-5cb3-11e7-907b-a6006ad3dba0'], [
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		]], // Array(Array(UUID))
		[[json, json], [json, json]], // Array(Array(JSON))
		[['116.253.40.133', '116.253.40.134'], ['116.253.40.133', '116.253.40.134']], // Array(Array(IPv4))
		[['2a02:aa08:e000:3100::2', '2a02:aa08:e000:3100::1'], ['2a02:aa08:e000:3100::2', '2a02:aa08:e000:3100::1']], // Array(Array(IPv6))
		[[true, false], [true, false]], // Array(Array(BOOL))
		[['qwerty', 1], ['qwerty', 1]], // Array(Array(Variant(UInt8, String)))
		[['qwerty1', 'qwerty2'], ['qwerty1', 'qwerty2']], // Array(Array(LowCardinality(String)))
		[[null, null], [null, null]], // Array(Array(Nullable(String)))
		'[[(10,-10),(11,-11)],[(10,-10),(11,-11)]]', // Array(Array(Point))
		'[[[(0,0),(10,0),(10,10),(0,10)]],[[(0,0),(10,0),(10,10),(0,10)]]]', // Array(Array(Ring))
		'[[[(0,0),(10,0),(10,10),(0,10)]],[[(0,0),(10,0),(10,10),(0,10)]]]', // Array(Array(LineString))
		'[[[[(0,0),(10,0),(10,10),(0,10)],[(1,1),(2,2),(3,3)]]],[[[(0,0),(10,0),(10,10),(0,10)],[(1,1),(2,2),(3,3)]]]]', // Array(Array(MultiLineString))
		'[[[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]],[[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]]', // Array(Array(Polygon))
		'[[[[[(0,0),(10,0),(10,10),(0,10)]],[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]],[[[[(0,0),(10,0),(10,10),(0,10)]],[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]]]', // Array(Array(MultiPolygon))
		[[new TupleParam([1, 'a']), new TupleParam([2, 'b'])], [new TupleParam([1, 'a']), new TupleParam([2, 'b'])]], // Array(Array(Tuple(i UInt8, s String)))
		[[new Map([['key1', 1], ['key2', 10]]), new Map([['key1', 2], ['key2', 11]])], [
			new Map([['key1', 1], ['key2', 10]]),
			new Map([['key1', 2], ['key2', 11]]),
		]], // Array(Array(Map(String, UInt8)))
		[['qwerty', 'qwerty1'], ['qwerty', 'qwerty1']], // Array(Array(Dynamic))
	];

	let types: string[] = [];

	const expectedRes = [
		[[-1, 2, 127], [-1, 2, 127]], // int8_array_2d
		[[-4, 5, 32767], [-4, 5, 32767]], // int16_array_2d
		[[-7, 8, 2147483647], [-7, 8, 2147483647]], // int32_array_2d
		[['-10', '11', '9223372036854775807'], ['-10', '11', '9223372036854775807']], // int64_array_2d
		[['-13', '14', '170141183460469231731687303715884105727'], [
			'-13',
			'14',
			'170141183460469231731687303715884105727',
		]], // int128_array_2d
		[[
			'-16',
			'17',
			'57896044618658097711785492504343953926634992332820282019728792003956564819967',
		], [
			'-16',
			'17',
			'57896044618658097711785492504343953926634992332820282019728792003956564819967',
		]], // int256_array_2d
		[[1, 2, 255], [1, 2, 255]], // uint8_array_2d
		[[4, 5, 65535], [4, 5, 65535]], // uint16_array_2d
		[[7, 8, 4294967295], [7, 8, 4294967295]], // uint32_array_2d
		[['10', '11', '18446744073709551615'], ['10', '11', '18446744073709551615']], // uint64_array_2d
		[['13', '14', '340282366920938463463374607431768211455'], ['13', '14', '340282366920938463463374607431768211455']], // uint128_array_2d
		[[
			'16',
			'17',
			'115792089237316195423570985008687907853269984665640564039457584007913129639935',
		], [
			'16',
			'17',
			'115792089237316195423570985008687907853269984665640564039457584007913129639935',
		]], // uint256_array_2d
		[[-1.234, 2.345], [-1.234, 2.345]], // float32_array_2d
		[[-3.456, 4.567], [-3.456, 4.567]], // float64_array_2d
		[[-0.59765625, 0.69921875], [-0.59765625, 0.69921875]], // bfloat16_array_2d
		[[0.123, -1.234], [0.123, -1.234]], // decimal32_array_2d
		[[1.234, -2.345], [1.234, -2.345]], // decimal64_array_2d
		[[3.456, -4.567], [3.456, -4.567]], // decimal128_array_2d
		[[5.678, -6.789], [5.678, -6.789]], // decimal256_array_2d
		[['qwerty1', 'qwerty2'], ['qwerty1', 'qwerty2']], // string_array_2d
		[['qwerty1234', 'qwerty2345'], ['qwerty1234', 'qwerty2345']], // fixed_string_array_2d
		[['2024-10-31', '2024-12-01'], ['2024-10-31', '2024-12-01']], // date_array_2d
		[['2024-10-30', '2024-11-30'], ['2024-10-30', '2024-11-30']], // date32_array_2d
		[['2024-10-31 14:25:29', '2024-12-01 14:25:29'], ['2024-10-31 14:25:29', '2024-12-01 14:25:29']], // date_time_array_2d
		[['2024-10-30 14:25:29.123', '2024-11-30 14:25:29.123'], ['2024-10-30 14:25:29.123', '2024-11-30 14:25:29.123']], // date_time64_array_2d
		[['hello', 'world'], ['hello', 'world']], // enum_array_2d
		[[
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		], [
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
			'61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		]], // uuid_array_2d
		[[json, json], [json, json]], // json_array_2d
		[['116.253.40.133', '116.253.40.134'], ['116.253.40.133', '116.253.40.134']], // ipv4_array_2d
		[['2a02:aa08:e000:3100::2', '2a02:aa08:e000:3100::1'], ['2a02:aa08:e000:3100::2', '2a02:aa08:e000:3100::1']], // ipv6_array_2d
		[[true, false], [true, false]], // boolean_array_2d
		[['qwerty', 1], ['qwerty', 1]], // variant_uint8_string_array_2d
		[['qwerty1', 'qwerty2'], ['qwerty1', 'qwerty2']], // low_cardinality_string_array_2d
		[[null, null], [null, null]], // nullable_string_array_2d
		[[[10, -10], [11, -11]], [[10, -10], [11, -11]]], // point_array_2d
		[[[[0, 0], [10, 0], [10, 10], [0, 10]]], [[[0, 0], [10, 0], [10, 10], [0, 10]]]], // ring_array_2d
		[[[[0, 0], [10, 0], [10, 10], [0, 10]]], [[[0, 0], [10, 0], [10, 10], [0, 10]]]], // line_string_array_2d
		[[[
			[[0, 0], [10, 0], [10, 10], [0, 10]],
			[[1, 1], [2, 2], [3, 3]],
		]], [[
			[[0, 0], [10, 0], [10, 10], [0, 10]],
			[[1, 1], [2, 2], [3, 3]],
		]]], // multi_line_string_array_2d
		[[[
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]], [[
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]]], // polygon_array_2d
		[[[[[[0, 0], [10, 0], [10, 10], [0, 10]]], [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]]], [[[[[0, 0], [10, 0], [10, 10], [0, 10]]], [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]]]], // multi_polygon_array_2d
		[[{ i: 1, s: 'a' }, { i: 2, s: 'b' }], [{ i: 1, s: 'a' }, { i: 2, s: 'b' }]], // tuple_uint8_string_array_2d
		[[{ key1: 1, key2: 10 }, { key1: 2, key2: 11 }], [{ key1: 1, key2: 10 }, { key1: 2, key2: 11 }]], // map_string_uint8_array_2d
		[['qwerty', 'qwerty1'], ['qwerty', 'qwerty1']], // dynamic_array_2d
	];

	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${
		sql.values([allArrayDataTypesValues], types)
	};`
		.command();

	const res = await sql.unsafe(`select * from \`all_nd_array_data_types\`;`, [], { rowMode: 'array' });

	expect(res[0]!.length).toBe(expectedRes.length);
	const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
		vitestExpectSoftDate(res[0]![idx], expectedValue)
	);
	expect(predicate).toBe(true);

	await dropAllNdarrayDataTypesTable(sql);
	await createAllNdarrayDataTypesTable(sql);

	types = [
		'Array(Array(Int8))',
		'Array(Array(Int16))',
		'Array(Array(Int32))',
		'Array(Array(Int64))',
		'Array(Array(Int128))',
		'Array(Array(Int256))',
		'Array(Array(UInt8))',
		'Array(Array(UInt16))',
		'Array(Array(UInt32))',
		'Array(Array(UInt64))',
		'Array(Array(UInt128))',
		'Array(Array(UInt256))',
		'Array(Array(Float32))',
		'Array(Array(Float64))',
		'Array(Array(BFloat16))',
		'Array(Array(Decimal32(7)))',
		'Array(Array(Decimal64(15)))',
		'Array(Array(Decimal128(34)))',
		'Array(Array(Decimal256(71)))',
		'Array(Array(String))',
		'Array(Array(FixedString(10)))',
		'Array(Array(Date))',
		'Array(Array(Date32))',
		'Array(Array(DateTime))',
		'Array(Array(DateTime64))',
		`Array(Array(Enum('hello', 'world')))`,
		'Array(Array(UUID))',
		'Array(Array(JSON))',
		'Array(Array(IPv4))',
		'Array(Array(IPv6))',
		'Array(Array(BOOL))',
		'String', // TODO: revise: cannot insert array with type case 'Array(Array(Variant(UInt8, String)))',
		'Array(Array(LowCardinality(String)))',
		'Array(Array(Nullable(String)))',
		'Array(Array(Point))',
		'Array(Array(Ring))',
		'Array(Array(LineString))',
		'Array(Array(MultiLineString))',
		'Array(Array(Polygon))',
		'Array(Array(MultiPolygon))',
		'Array(Array(Tuple(UInt8,String)))',
		'Array(Array(Map(String, UInt8)))',
	];

	await sql`insert into ${sql.identifier('all_nd_array_data_types')} values ${
		sql.values([allArrayDataTypesValues], types)
	};`
		.command();

	await sql.unsafe(`select * from \`all_nd_array_data_types\`;`, [], { rowMode: 'object' }).query();
});

test('sql.stream test', async () => {
	await dropAllDataTypesTable(sql);
	await createAllDataTypesTable(sql);

	const allDataTypesValues = [
		127, // int8
		32767, // int16
		2147483647, // int32
		'9223372036854775807', // int64 ; TODO revise: seems like driver does not support BigInt type
		'170141183460469231731687303715884105727', // int128
		'57896044618658097711785492504343953926634992332820282019728792003956564819967', // int256
		255, // uint8
		65535, // uint16
		4294967295, // uint32
		'18446744073709551615', // uint64
		'340282366920938463463374607431768211455', // uint128
		'115792089237316195423570985008687907853269984665640564039457584007913129639935', // uint256
		10.123, // float32
		100.123456, // float32
		1.123, // bfloat16
		10.23, // decimal32(7) P from [ 1 : 9 ]
		100.23, // decimal64(15) P from [ 10 : 18 ]
		1000.23, // decimal128(34) P from [ 19 : 38 ]
		10000.23, // decimal256(71) P from [ 39 : 76 ]
		'qwerty', // string
		'qwerty1234', // string(10)
		'2024-10-31', // date ; TODO revise: seems like driver does not support Date type
		'2024-10-31', // date32 '2024-10-31'
		new Date('2024-10-31T14:25:29'), // datetime
		new Date('2024-10-31T14:25:29.123'), // datetime64
		'hello', // enum('hello', 'world')
		'61f0c404-5cb3-11e7-907b-a6006ad3dba0', // uuid
		JSON.stringify({
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		}), // json
		'116.253.40.133', // ipv4
		'2a02:aa08:e000:3100::2', // ipv6
		true, // bool
		'qwerty', // Variant(UInt8, String)
		'qwerty', // LowCardinality(String)
		null, // Nullable(String) TODO: revise: select returns empty string not a null
		'(10,-10)', // Point ; TODO: revise driver cannot handle node js array in client.command query_params;
		// Feature: add sql.toTuple, sql.toPoint function and similar
		'[(0,0),(10,0),(10,10),(0,10)]', // Ring
		'[(0,0),(10,0),(10,10),(0,10)]', // LineString
		'[[(0,0),(10,0),(10,10),(0,10)],[(1,1),(2,2),(3,3)]]', // MultiLineString
		'[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]', // Polygon
		'[[[(0,0),(10,0),(10,10),(0,10)]],[[(20,20),(50,20),(50,50),(20,50)],[(30,30),(50,50),(50,30)]]]', // MultiPolygon
		new TupleParam([0, 'a']), // "(0, 'a')", // Tuple(i UInt8, s String) ;
		new Map([['key1', 1], ['key2', 10]]), // Map(String, UInt8)
		sql.raw("'qwerty'"), // Dynamic
		sql.default,
	];

	const types: string[] = [];
	types[27] = 'JSON';
	types[14] = 'BFloat16';
	await sql`insert into \`all_data_types\` values ${sql.values([allDataTypesValues], types)};`
		.command();

	const expectedRes = {
		int8: 127,
		int16: 32767,
		int32: 2147483647,
		int64: '9223372036854775807',
		int128: '170141183460469231731687303715884105727',
		int256: '57896044618658097711785492504343953926634992332820282019728792003956564819967',
		uint8: 255,
		uint16: 65535,
		uint32: 4294967295,
		uint64: '18446744073709551615',
		uint128: '340282366920938463463374607431768211455',
		uint256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
		float32: 10.123,
		float64: 100.123456,
		bfloat16: 1.1171875,
		decimal32: 10.23,
		decimal64: 100.23,
		decimal128: 1000.23,
		decimal256: 10000.23,
		string: 'qwerty',
		fixed_string: 'qwerty1234',
		date: '2024-10-31',
		date32: '2024-10-31',
		date_time: '2024-10-31 12:25:29',
		date_time64: '2024-10-31 12:25:29.123',
		enum: 'hello',
		uuid: '61f0c404-5cb3-11e7-907b-a6006ad3dba0',
		json: {
			name: 'alex',
			age: 26,
			bookIds: [1, 2, 3],
			vacationRate: 2.5,
			aliases: ['sasha', 'sanya'],
			isMarried: true,
		},
		ipv4: '116.253.40.133',
		ipv6: '2a02:aa08:e000:3100::2',
		boolean: true,
		variant_uint8_string: 'qwerty',
		low_cardinality_string: 'qwerty',
		nullable_string: '',
		point: [10, -10],
		ring: [[0, 0], [10, 0], [10, 10], [0, 10]],
		line_string: [[0, 0], [10, 0], [10, 10], [0, 10]],
		multi_line_string: [
			[[0, 0], [10, 0], [10, 10], [0, 10]],
			[[1, 1], [2, 2], [3, 3]],
		],
		polygon: [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		],
		multi_polygon: [[[[0, 0], [10, 0], [10, 10], [0, 10]]], [
			[[20, 20], [50, 20], [50, 50], [20, 50]],
			[[30, 30], [50, 50], [50, 30]],
		]],
		tuple_uint8_string: { i: 0, s: 'a' },
		map_string_uint8: { key1: 1, key2: 10 },
		dynamic: 'qwerty',
		default_int: defaultValue,
	} as Record<string, any>;

	const stream0 = sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'object' }).query().stream();

	for await (const row of stream0) {
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.entries(row as Record<string, any>).every(([colName, colValue]) =>
			vitestExpectSoftDate(colValue, expectedRes[colName])
		);
		expect(predicate).toBe(true);
		// expect(row).toStrictEqual(expectedRes);
	}

	const stream1 = sql.unsafe(`select * from \`all_data_types\`;`, [], { rowMode: 'array' }).query().stream();

	for await (const row of stream1) {
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.values(expectedRes).every((expectedValue, idx) =>
			vitestExpectSoftDate(row[idx], expectedValue)
		);
		expect(predicate).toBe(true);
		// expect(row).toStrictEqual(Object.values(expectedRes));
	}

	const stream2 = sql`select * from \`all_data_types\`;`.query().stream();

	for await (const row of stream2) {
		expect(Object.keys(row).length).toBe(Object.keys(expectedRes).length);
		const predicate = Object.entries(row as Record<string, any>).every(([colName, colValue]) =>
			vitestExpectSoftDate(colValue, expectedRes[colName])
		);
		expect(predicate).toBe(true);
	}
});

test('query database test from documentation', async () => {
	await sql.unsafe(`drop table if exists users;`).command();
	await sql.unsafe(`create table users(
    id    Int32,
    name  String,
    age   Int32,
    email String
)
engine = MergeTree
order by id;
  `).command();

	const user = [
		'John',
		30,
		'john@example.com',
	];
	await sql`insert into ${sql.identifier('users')} values ${sql.values([[sql.default, ...user]])};`.command();
	// console.log('New user created!');
	const _users = await sql`select * from ${sql.identifier('users')};`.query();
	// console.log('Getting all users from the database:', users);
	/*
  const users: {
    id: number;
    name: string;
    age: number;
    email: string;
  }[]
  */
	const query = sql`alter table ${sql.identifier('users')} update age = ${sql.param(31, 'Int32')} where email = ${
		user[2]
	};`.command();
	// console.log(query.toSQL());
	await query;
	// console.log('User info updated!');

	const stream = sql`select * from ${sql.identifier('users')};`.query().stream();

	// console.log('Streaming users one at a time from the database.');
	for await (const _user of stream) {
		// console.log(user);
		/*
    const user: {
      id: number;
      name: string;
      age: number;
      email: string;
    }
    */
	}

	await sql`alter table ${sql.identifier('users')} delete where email = ${user[2]};`.command();
	// console.log('User deleted!');

	await sql.unsafe(`drop table if exists users;`).command();
});

test('sql query api test', async () => {
	const filter = sqlQuery`id = ${sql.param(1, 'Int32')} or ${sqlQuery`id = ${2}`}`;
	filter.append(sqlQuery` and email = ${'hello@test.com'}`);

	const query = sql`select * from ${sqlQuery.identifier('users')} where ${filter};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = {param1:Int32} or id = {param2:Int32} and email = {param3:String};',
		params: { param1: 1, param2: 2, param3: 'hello@test.com' },
	});
	expect(filter.toSQL()).toStrictEqual({
		sql: 'id = {param1:Int32} or id = {param2:Int32} and email = {param3:String}',
		params: { param1: 1, param2: 2, param3: 'hello@test.com' },
	});
});

test('embeding SQLQuery and SQLTemplate test', async () => {
	await sql.unsafe(`drop table if exists users;`).command();
	await sql.unsafe(`create table users(
    id    Int32,
    name  String,
    age   Int32,
    email String
)
engine = MergeTree
order by id;
  `).command();

	await sql`insert into users values ${
		sql.values([[1, 'a', 23, 'example1@gmail.com'], [2, 'b', 24, 'example2@gmail.com']])
	}`.command();

	await sql`select * from ${sql.identifier('users')};`;

	const query1 = sql`select * from ${sql.identifier('users')} where ${filter1({ id: 1, name: 'a' })};`;
	expect(query1.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = {param1:Int32} and name = {param2:String};',
		params: { param1: 1, param2: 'a' },
	});

	const res1 = await query1;
	expect(res1.length).not.toBe(0);

	const query2 = sql`select * from ${sql.identifier('users')} where ${filter2({ id: 1, name: 'a' })};`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = {param1:Int32} and name = {param2:String};',
		params: { param1: 1, param2: 'a' },
	});

	const res2 = await query2;
	expect(res2.length).not.toBe(0);

	const query3 = sql`select * from ${sql.identifier('users')} where ${sql`id = ${sql.param(1, 'Int32')}`};`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select * from `users` where id = {param1:Int32};',
		params: { param1: 1 },
	});

	const res3 = await query3;
	expect(res3.length).not.toBe(0);

	await sql.unsafe(`drop table if exists users;`).command();
});

test('insert benchmark', async () => {
	await sql.unsafe(`create table tests(
    id    Int32
)
engine = MergeTree
order by id;
  `).command();

	const valuesIds = Array.from({ length: 10 ** 4 }).fill([1]) as number[][];

	console.time('insert');
	const query = sql`insert into ${sql.identifier('tests')} values ${sql.values(valuesIds)};`.command();
	// const { sql: rawSql, params } = query.toSQL();
	await query;
	// const rawSqlNew = rawSql.slice(0, -1) + ' FORMAT JSONEachRow;';
	// await clickHouseClient.command({ sql: rawSql, query_params: params as Record<string, any> });
	// await clickHouseClient.insert({
	// 	table: 'tests',
	// 	query_params: params as Record<string, any>,
	// 	values: valuesIds,
	// });

	console.timeEnd('insert');
	// console.log('New user created!');
	// const ids = await sql`select * from ${sql.identifier('tests')};`.query();
	// console.log('Getting all users from the database:', ids);

	await sql.unsafe(`drop table tests;`).command();
});

test('1d array of strings, integer as SQLCommonParam test', async () => {
	await sql.unsafe(`create table tests(
    id    Int32,
	path  String
)
engine = MergeTree
order by id;
  `).command();

	const valuesToInsert = [[1, '/'], [2, '/watch'], [3, '/over_watch']];

	await sql`insert into tests values ${sql.values(valuesToInsert)};`.command();

	// case0
	const query0 = sql`select * from tests where path in ${['/', '/watch']};`;
	expect(query0.toSQL()).toStrictEqual({
		sql: 'select * from tests where path in {param1:Array(String)};',
		params: { param1: ['/', '/watch'] },
	});

	const res0 = await query0;
	expect(res0).toStrictEqual([{ id: 1, path: '/' }, { id: 2, path: '/watch' }]);

	// case1 (datetime)
	const query1 = sql`select toDateTime(${1754055760745}, 3) as some_datetime;`;
	expect(query1.toSQL()).toStrictEqual({
		sql: 'select toDateTime({param1:Int64}, 3) as some_datetime;',
		params: { param1: 1754055760745 },
	});

	const res1 = await query1;
	expect(res1.length).equal(1);

	// case2 (int32 max)
	const query2 = sql`select ${2_147_483_647} as max_int32;`;
	expect(query2.toSQL()).toStrictEqual({
		sql: 'select {param1:Int32} as max_int32;',
		params: { param1: 2147483647 },
	});

	const res2 = await query2;
	expect(res2).toStrictEqual([{ max_int32: 2147483647 }]);

	// case3 (int32 min)
	const query3 = sql`select ${-2_147_483_648} as min_int32;`;
	expect(query3.toSQL()).toStrictEqual({
		sql: 'select {param1:Int32} as min_int32;',
		params: { param1: -2147483648 },
	});

	const res3 = await query3;
	expect(res3).toStrictEqual([{ min_int32: -2147483648 }]);

	// case4 (float)
	const query4 = sql`select ${-2_147_483_648.123} as some_float;`;
	expect(query4.toSQL()).toStrictEqual({
		sql: 'select {param1:String} as some_float;',
		params: { param1: -2147483648.123 },
	});

	const res4 = await query4;
	expect(res4).toStrictEqual([{ some_float: '-2147483648.123' }]);

	await sql.unsafe(`drop table tests;`).command();
});

test('logger test', async () => {
	const { host: _, port: __, ...filteredParams } = clickHouseConnectionParams;
	const loggerQuery = 'select {param1:Int32};';
	const loggerParams = { param1: 1 };
	const loggerText = `Query: ${loggerQuery} -- params: {"param1":"1"}`;

	// metadata example:
	// {
	// 	meta: [ { name: "_CAST(1, 'Int32')", type: 'Int32' } ],
	// 	rows: 1,
	// 	statistics: { elapsed: 0.013193458, rows_read: 1, bytes_read: 1 }
	// }
	const logger = {
		logQuery: (query: string, params: Record<string, unknown>, metadata: any) => {
			expect(query).toEqual(loggerQuery);
			expect(params).toStrictEqual(loggerParams);

			expect(Object.keys(metadata)).toStrictEqual(['meta', 'rows', 'statistics']);
			expect(Object.keys(metadata.statistics)).toStrictEqual(['elapsed', 'rows_read', 'bytes_read']);
		},
	};

	let loggerSql: ClickHouseSQL;
	const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});

	// case 0
	const client = createClient(filteredParams);
	loggerSql = waddler({ client, logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ client, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ client, logger: false });
	await loggerSql`select ${1};`;

	await client.close();

	// case 1
	loggerSql = waddler({ connection: filteredParams, logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler({ connection: filteredParams, logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler({ connection: filteredParams, logger: false });
	await loggerSql`select ${1};`;

	// case 2
	const url =
		`http://${clickHouseConnectionParams.user}:${clickHouseConnectionParams.password}@${clickHouseConnectionParams.host}:${clickHouseConnectionParams.port}/${clickHouseConnectionParams.database}`;

	loggerSql = waddler(url, { logger });
	await loggerSql`select ${1};`;

	loggerSql = waddler(url, { logger: true });
	await loggerSql`select ${1};`;
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerText));

	loggerSql = waddler(url, { logger: false });
	await loggerSql`select ${1};`;

	// case 3
	const loggerQueryCommand = 'create table logger_command_test(id Int32) engine = MergeTree order by id;';
	const loggerParamsCommand = {};
	const loggerTextCommand = `Query: ${loggerQueryCommand}`;

	// metadata example:
	// 	{
	//   query_id: '4e8e2236-149f-4a33-a475-ecfe988374ed',
	//   summary: {
	//     read_rows: '0',
	//     read_bytes: '0',
	//     written_rows: '0',
	//     written_bytes: '0',
	//     total_rows_to_read: '0',
	//     result_rows: '0',
	//     result_bytes: '0',
	//     elapsed_ns: '11163000'
	//   },
	//   response_headers: {
	//     'x-clickhouse-summary': '{"read_rows":"0","read_bytes":"0","written_rows":"0","written_bytes":"0","total_rows_to_read":"0","result_rows":"0","result_bytes":"0","elapsed_ns":"11163000"}',
	//     date: 'Tue, 12 Aug 2025 01:57:59 GMT',
	//     connection: 'Keep-Alive',
	//     'content-type': 'text/plain; charset=UTF-8',
	//     'access-control-expose-headers': 'X-ClickHouse-Query-Id,X-ClickHouse-Summary,X-ClickHouse-Server-Display-Name,X-ClickHouse-Format,X-ClickHouse-Timezone,X-ClickHouse-Exception-Code',
	//     'x-clickhouse-server-display-name': 'b1fb20216212',
	//     'transfer-encoding': 'chunked',
	//     'x-clickhouse-query-id': '4e8e2236-149f-4a33-a475-ecfe988374ed',
	//     'x-clickhouse-timezone': 'UTC',
	//     'keep-alive': 'timeout=10, max=9999'
	//   }
	// }
	const loggerCommand = {
		logQuery: (query: string, params: Record<string, unknown>, metadata: any) => {
			expect(query).toEqual(loggerQueryCommand);
			expect(params).toStrictEqual(loggerParamsCommand);

			console.log(metadata);
		},
	};

	const client1 = createClient(filteredParams);
	loggerSql = waddler({ client: client1, logger: loggerCommand });
	await loggerSql`create table logger_command_test(id Int32) engine = MergeTree order by id;`.command();
	await sql`drop table logger_command_test;`.command();

	loggerSql = waddler({ client: client1, logger: true });
	await loggerSql`create table logger_command_test(id Int32) engine = MergeTree order by id;`.command();
	expect(consoleMock).toBeCalledWith(expect.stringContaining(loggerTextCommand));
	await sql`drop table logger_command_test;`.command();

	loggerSql = waddler({ client: client1, logger: false });
	await loggerSql`create table logger_command_test(id Int32) engine = MergeTree order by id;`.command();
	await sql`drop table logger_command_test;`.command();

	await client1.close();

	consoleMock.mockRestore();
});

test('standalone sql test', async () => {
	const timestampSelector = sqlQuery`toStartOfHour(${sqlQuery.identifier('test')})`;
	const timestampFilter =
		sqlQuery`${sqlQuery``}${timestampSelector} >= from and ${timestampSelector} < to${sqlQuery``}${sqlQuery`;`}`;

	expect(timestampFilter.toSQL()).toStrictEqual({
		sql: 'toStartOfHour(`test`) >= from and toStartOfHour(`test`) < to;',
		params: {},
	});
});
