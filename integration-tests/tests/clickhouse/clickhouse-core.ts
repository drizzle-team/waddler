import { describe, expect, test } from 'vitest';
import type { ClickHouseSQL } from 'waddler/clickhouse';

export const defaultValue = 3;

export const createAllDataTypesTable = async (sql: ClickHouseSQL) => {
	// await sql.unsafe(`set enable_time_time64_type = 1;`).command();
	await sql.unsafe(`create table if not exists \`all_data_types\` (
      \`int8\` Int8,
      \`int16\` Int16,
      \`int32\` Int32,
      \`int64\` Int64,
      \`int128\` Int128,
      \`int256\` Int256,
      \`uint8\` UInt8,
      \`uint16\` UInt16,
      \`uint32\` UInt32,
      \`uint64\` UInt64,
      \`uint128\` UInt128,
      \`uint256\` UInt256,
      \`float32\` Float32,
      \`float64\` Float64,
      \`bfloat16\` BFloat16,
      \`decimal32\` Decimal32(7),
      \`decimal64\` Decimal64(15),
      \`decimal128\` Decimal128(34),
      \`decimal256\` Decimal256(71),
      \`string\` String,
      \`fixed_string\` FixedString(10),
      \`date\` Date,
      \`date32\` Date32,
      \`date_time\` DateTime,
      \`date_time64\` DateTime64,
      \`enum\` Enum('hello', 'world'),
      \`uuid\` UUID,
      \`json\` JSON,
      \`ipv4\` IPv4,
      \`ipv6\` IPv6,
      \`boolean\` BOOL,
      \`variant_uint8_string\` Variant(UInt8, String),
      \`low_cardinality_string\` LowCardinality(String),
      \`nullable_string\` Nullable(String),
      \`point\` Point,
      \`ring\` Ring,
      \`line_string\` LineString,
      \`multi_line_string\` MultiLineString,
      \`polygon\` Polygon,
      \`multi_polygon\` MultiPolygon,
      \`tuple_uint8_string\` Tuple(i UInt8, s String),
      \`map_string_uint8\` Map(String, UInt8),
      \`dynamic\` Dynamic,
      -- \`time\` Time,
      -- \`time64\` Time64,
      \`default_int\` UInt8 default 3
    )
    engine = MergeTree
order by \`int8\`;`).command();
};

export const dropAllDataTypesTable = async (sql: ClickHouseSQL) => {
	await sql.unsafe(`drop table if exists \`all_data_types\`;`).command();
};

export const createAllArrayDataTypesTable = async (sql: ClickHouseSQL) => {
	await sql.unsafe(`CREATE TABLE IF NOT EXISTS \`all_array_data_types\` (
\`int8_array\` Array(Int8),
\`int16_array\` Array(Int16),
\`int32_array\` Array(Int32),
\`int64_array\` Array(Int64),
\`int128_array\` Array(Int128),
\`int256_array\` Array(Int256),
\`uint8_array\` Array(UInt8),
\`uint16_array\` Array(UInt16),
\`uint32_array\` Array(UInt32),
\`uint64_array\` Array(UInt64),
\`uint128_array\` Array(UInt128),
\`uint256_array\` Array(UInt256),
\`float32_array\` Array(Float32),
\`float64_array\` Array(Float64),
\`bfloat16_array\` Array(BFloat16),
\`decimal32_array\` Array(Decimal32(7)),
\`decimal64_array\` Array(Decimal64(15)),
\`decimal128_array\` Array(Decimal128(34)),
\`decimal256_array\` Array(Decimal256(71)),
\`string_array\` Array(String),
\`fixed_string_array\` Array(FixedString(10)),
\`date_array\` Array(Date),
\`date32_array\` Array(Date32),
\`date_time_array\` Array(DateTime),
\`date_time64_array\` Array(DateTime64),
\`enum_array\` Array(Enum('hello', 'world')),
\`uuid_array\` Array(UUID),
\`json_array\` Array(JSON),
\`ipv4_array\` Array(IPv4),
\`ipv6_array\` Array(IPv6),
\`boolean_array\` Array(BOOL),
\`variant_uint8_string_array\` Array(Variant(UInt8, String)),
\`low_cardinality_string_array\` Array(LowCardinality(String)),
\`nullable_string_array\` Array(Nullable(String)),
\`point_array\` Array(Point),
\`ring_array\` Array(Ring),
\`line_string_array\` Array(LineString),
\`multi_line_string_array\` Array(MultiLineString),
\`polygon_array\` Array(Polygon),
\`multi_polygon_array\` Array(MultiPolygon),
\`tuple_uint8_string_array\` Array(Tuple(i UInt8, s String)),
\`map_string_uint8_array\` Array(Map(String, UInt8)),
\`dynamic_array\` Array(Dynamic)
)
ENGINE = MergeTree ORDER BY tuple();`).command();
};

export const dropAllArrayDataTypesTable = async (sql: ClickHouseSQL) => {
	await sql.unsafe(`drop table if exists \`all_array_data_types;\``).command();
};

export const createAllNdarrayDataTypesTable = async (sql: ClickHouseSQL) => {
	await sql.unsafe(`CREATE TABLE if not exists \`all_nd_array_data_types\` (
\`int8_array_2d\` Array(Array(Int8)),
\`int16_array_2d\` Array(Array(Int16)),
\`int32_array_2d\` Array(Array(Int32)),
\`int64_array_2d\` Array(Array(Int64)),
\`int128_array_2d\` Array(Array(Int128)),
\`int256_array_2d\` Array(Array(Int256)),
\`uint8_array_2d\` Array(Array(UInt8)),
\`uint16_array_2d\` Array(Array(UInt16)),
\`uint32_array_2d\` Array(Array(UInt32)),
\`uint64_array_2d\` Array(Array(UInt64)),
\`uint128_array_2d\` Array(Array(UInt128)),
\`uint256_array_2d\` Array(Array(UInt256)),
\`float32_array_2d\` Array(Array(Float32)),
\`float64_array_2d\` Array(Array(Float64)),
\`bfloat16_array_2d\` Array(Array(BFloat16)),
\`decimal32_array_2d\` Array(Array(Decimal32(7))),
\`decimal64_array_2d\` Array(Array(Decimal64(15))),
\`decimal128_array_2d\` Array(Array(Decimal128(34))),
\`decimal256_array_2d\` Array(Array(Decimal256(71))),
\`string_array_2d\` Array(Array(String)),
\`fixed_string_array_2d\` Array(Array(FixedString(10))),
\`date_array_2d\` Array(Array(Date)),
\`date32_array_2d\` Array(Array(Date32)),
\`date_time_array_2d\` Array(Array(DateTime)),
\`date_time64_array_2d\` Array(Array(DateTime64)),
\`enum_array_2d\` Array(Array(Enum('hello', 'world'))),
\`uuid_array_2d\` Array(Array(UUID)),
\`json_array_2d\` Array(Array(JSON)),
\`ipv4_array_2d\` Array(Array(IPv4)),
\`ipv6_array_2d\` Array(Array(IPv6)),
\`boolean_array_2d\` Array(Array(BOOL)),
\`variant_uint8_string_array_2d\` Array(Array(Variant(UInt8, String))),
\`low_cardinality_string_array_2d\` Array(Array(LowCardinality(String))),
\`nullable_string_array_2d\` Array(Array(Nullable(String))),
\`point_array_2d\` Array(Array(Point)),
\`ring_array_2d\` Array(Array(Ring)),
\`line_string_array_2d\` Array(Array(LineString)),
\`multi_line_string_array_2d\` Array(Array(MultiLineString)),
\`polygon_array_2d\` Array(Array(Polygon)),
\`multi_polygon_array_2d\` Array(Array(MultiPolygon)),
\`tuple_uint8_string_array_2d\` Array(Array(Tuple(i UInt8, s String))),
\`map_string_uint8_array_2d\` Array(Array(Map(String, UInt8))),
\`dynamic_array_2d\` Array(Array(Dynamic))
)
ENGINE = MergeTree ORDER BY tuple();`).command();
};

export const dropAllNdarrayDataTypesTable = async (sql: ClickHouseSQL) => {
	await sql.unsafe(`drop table if exists \`all_nd_array_data_types\`;`).command();
};

export const commonClickHouseTests = () => {
	describe('common_clickhouse_tests', () => {
		// default ------------------------------------------------------------------------------
		test<{ sql: ClickHouseSQL }>('sql.default test using with sql.values.', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values ${ctx.sql.values([[ctx.sql.default]])};`.toSQL();
			expect(res).toStrictEqual({ query: 'insert into users (id, name) values (default);', params: {} });
		});

		test<{ sql: ClickHouseSQL }>('sql.default test using with sql`${}` as parameter.', (ctx) => {
			const res = ctx.sql`insert into users (id, name) values (${ctx.sql.default}, 'name1');`.toSQL();
			expect(res).toStrictEqual({ query: "insert into users (id, name) values (default, 'name1');", params: {} });
		});

		// toSQL
		test('base test with number param', (ctx) => {
			const res = ctx.sql`select ${1};`.toSQL();

			expect(res).toStrictEqual({ query: `select {param1:String};`, params: { param1: 1 } });
		});

		test('base test with bigint param', (ctx) => {
			const res = ctx.sql`select ${BigInt(10)};`.toSQL();

			expect(res).toStrictEqual({ query: `select {param1:String};`, params: { param1: 10n } });
		});

		test('base test with string param', (ctx) => {
			const res = ctx.sql`select ${'hello world.'};`.toSQL();

			expect(res).toStrictEqual({ query: `select {param1:String};`, params: { param1: 'hello world.' } });
		});

		test('base test with boolean param', (ctx) => {
			const res = ctx.sql`select ${true};`.toSQL();

			expect(res).toStrictEqual({ query: `select {param1:String};`, params: { param1: true } });
		});

		test('base test with Date param', (ctx) => {
			const res = ctx.sql`select ${new Date('10.04.2025')};`.toSQL();

			expect(res).toStrictEqual({ query: `select {param1:String};`, params: { param1: new Date('10.04.2025') } });
		});

		test('base test with null param', (ctx) => {
			const res = ctx.sql`select ${null};`.toSQL();

			expect(res).toStrictEqual({ query: `select {param1:String};`, params: { param1: null } });
		});

		// sql.append
		test('sql.append test.', (ctx) => {
			const query = ctx.sql<undefined>`select * from users where id = ${1}`;

			query.append(ctx.sql` or id = ${3}`);
			query.append(ctx.sql` or id = ${4};`);

			const res = query.toSQL();
			expect(res).toStrictEqual({
				query: 'select * from users where id = {param1:String} or id = {param2:String} or id = {param3:String};',
				params: { param1: 1, param2: 3, param3: 4 },
			});
		});

		// identifier ----------------------------------------------------------------------------------
		test('sql.identifier test. string parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier('name')} from users;`.toSQL();

			expect(res).toStrictEqual({ query: `select \`name\` from users;`, params: {} });
		});

		test('sql.identifier test. string[] parameter', (ctx) => {
			const res = ctx.sql`select ${ctx.sql.identifier(['name', 'email', 'phone'])} from users;`.toSQL();

			expect(res).toStrictEqual({ query: `select \`name\`, \`email\`, \`phone\` from users;`, params: {} });
		});

		test('sql.identifier test. object parameter', (ctx) => {
			const res = ctx.sql`select * from ${ctx.sql.identifier({ schema: 'public', table: 'users' })};`.toSQL();

			expect(res).toStrictEqual({ query: `select * from \`public\`.\`users\`;`, params: {} });
		});

		test('sql.identifier test. object[] parameter', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier([
					{ schema: 'public', table: 'users', column: 'name' },
					{ schema: 'public', table: 'users', column: 'email' },
				])
			} from users;`.toSQL();

			expect(res).toStrictEqual({
				query: `select \`public\`.\`users\`.\`name\`, \`public\`.\`users\`.\`email\` from users;`,
				params: {},
			});
		});

		test('sql.identifier test. object[] parameter', (ctx) => {
			const res = ctx.sql`select ${
				ctx.sql.identifier([
					{ schema: 'public', table: 'users', column: 'name', as: 'user_name' },
					{ schema: 'public', table: 'users', column: 'email', as: 'user_email' },
				])
			} from users;`.toSQL();

			expect(res).toStrictEqual({
				query:
					`select \`public\`.\`users\`.\`name\` as \`user_name\`, \`public\`.\`users\`.\`email\` as \`user_email\` from users;`,
				params: {},
			});
		});

		// errors
		test('sql.identifier test. undefined | number | bigint | boolean | symbol | function | null as parameter. error', (ctx) => {
			const paramList = [undefined, 1, BigInt(10), true, Symbol('fooo'), () => {}];
			for (const param of paramList) {
				expect(
					// @ts-ignore
					() => ctx.sql`select ${ctx.sql.identifier(param)} from users;`.toSQL(),
				).toThrowError(`you can't specify ${typeof param} as parameter for sql.identifier.`);
			}

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.identifier(null)} from users;`.toSQL(),
			).toThrowError(`you can't specify null as parameter for sql.identifier.`);
		});

		test('sql.identifier test. array of undefined | number | bigint | boolean | symbol | function | null | array as parameter. error', (ctx) => {
			const paramList = [
				['name', undefined],
				['name', 1],
				['name', BigInt(10)],
				['name', true],
				['name', Symbol('foo')],
				['name', () => {}],
			];
			for (const param of paramList) {
				expect(
					// @ts-ignore
					() => ctx.sql`select ${ctx.sql.identifier(param)} from users;`.toSQL(),
				).toThrowError(
					`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
				);
			}

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.identifier([null])} from users;`.toSQL(),
			).toThrowError(
				`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
			);

			expect(
				// @ts-ignore
				() => ctx.sql`select ${ctx.sql.identifier(['name', []])} from users;`.toSQL(),
			).toThrowError(`you can't specify array of arrays as parameter for sql.identifier.`);
		});

		test("sql.identifier test. 'empty array' error", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier([])} from users;`.toSQL(),
			).toThrowError(`you can't specify empty array as parameter for sql.identifier.`);
		});

		test("sql.identifier test. 'undefined in parameters' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${ctx.sql.identifier({ schema: undefined })}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`you can't specify undefined parameters. maybe you want to omit it?`);
		});

		test("sql.identifier test. 'no parameters' error with object parameter", (ctx) => {
			expect(
				() => ctx.sql`select ${ctx.sql.identifier({})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`you need to specify at least one parameter.`);
		});

		test("sql.identifier test. 'only schema and column' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						ctx.sql.identifier({ schema: 'public', column: 'name' })
					}, "email", "phone" from "public"."users";`
						.toSQL(),
			).toThrowError(`you can't specify only "schema" and "column" properties, you need also specify "table".`);
		});

		test("sql.identifier test. 'only as' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${ctx.sql.identifier({ as: 'user_name' })}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`you can't specify only "as" property.`);
		});

		test("sql.identifier test. 'column or table should be specified with as' error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						ctx.sql.identifier({ schema: 'public', as: 'user_name' })
					}, "email", "phone" from "public"."users";`
						.toSQL(),
			).toThrowError(`you have to specify "column" or "table" property along with "as".`);
		});

		test("sql.identifier test. wrong types in object's properties 'schema', 'table', 'column', 'as'. error with object parameter", (ctx) => {
			expect(
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 'public',
							table: 'users',
							column: 'name',
							as: 4,
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 'public',
							table: 'users',
							column: 4,
							as: 'user_name',
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 'public',
							table: 4,
							column: 'name',
							as: 'user_name',
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);

			expect(
				// @ts-ignore
				() =>
					ctx.sql`select ${
						// @ts-ignore
						ctx.sql.identifier({
							schema: 4,
							table: 'users',
							column: 'name',
							as: 'user_name',
						})}, "email", "phone" from "public"."users";`.toSQL(),
			).toThrowError(`object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.`);
		});
	});
};
