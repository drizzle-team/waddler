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
