import type { SQL } from 'waddler';

export const defaultValue = 3;

export const createMoodEnumType = async (sql: SQL) => {
	await sql.unsafe(
		`CREATE TYPE "mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');`,
	).catch(() => {});
	// analog to "create type if exists"; attempting to create a type that already exists will cause an error.
};

export const dropMoodEnumType = async (sql: SQL) => {
	await sql.unsafe(
		`DROP TYPE "mood_enum";`,
	).catch(() => {});
};
export const createAllDataTypesTable = async (sql: SQL) => {
	await createMoodEnumType(sql);

	await sql.unsafe(`
			    CREATE TABLE IF NOT EXISTS "all_data_types" (
				"int2" int2,
				"int4" int4,
				"int8" int8,
				"numeric" numeric,
				"decimal" numeric,
				"real" real,
				"double_precision" double precision,
				"boolean" boolean,
				"char" char(9),
				"varchar" varchar(256),
				"string" string,
				"bit" bit(5),
				"jsonb" jsonb,
				"time" time,
				"timestamp" timestamp,
				"date" date,
				"interval" interval,
				"mood_enum" "mood_enum",
				"uuid" uuid,
				"inet" inet,
				"geometry" geometry(point, 0),
				"vector" vector(3),
				"default" int2 default ${defaultValue}
			);
		`);
};

export const dropAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_data_types;');
	// await dropMoodEnumType(sql);
};

export const createAllArrayDataTypesTable = async (sql: SQL) => {
	await createMoodEnumType(sql);

	await sql.unsafe(`
			    CREATE TABLE IF NOT EXISTS "all_array_data_types" (
				int2_array int2[],
				int4_array int4[],
				int8_array int8[],
				numeric_array numeric[],
				decimal_array numeric[],
				real_array real[],
				double_precision_array double precision[],
				boolean_array boolean[],
				char_array char(9)[],
				varchar_array varchar(256)[],
				string_array string[],
				bit_array bit(5)[],
				time_array time[],
				timestamp_array timestamp[],
				date_array date[],
				interval_array interval[],
				mood_enum_array "mood_enum"[],
				uuid_array uuid[],
				inet_array inet[],
				geometry_array geometry(point, 0)[]
			);
		`);
};

export const dropAllArrayDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_array_data_types;');
	// await dropMoodEnumType(sql);
};

export const createUsersTable = async (sql: SQL) => {
	await sql.unsafe(`create table users(
    id    int4,
    name  string,
    age   int4,
    email string
	);`);
};

export const dropUsersTable = async (sql: SQL) => {
	await sql.unsafe(`drop table if exists users;`);
};
