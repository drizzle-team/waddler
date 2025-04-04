import type { SQL } from '~/sql';

export const defaultValue = 3;
export const createAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe(`DO $$ BEGIN
		CREATE TYPE "public"."mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');
	   EXCEPTION
		WHEN duplicate_object THEN null;
	   END $$;
   `);

	await sql.unsafe(`create table all_data_types (
    "integer" integer,
	"smallint" smallint,
	"bigint" bigint,
	"serial" serial,
	"smallserial" smallserial,
	"bigserial" bigserial,
	"boolean" boolean,
	"text" text,
	"varchar" varchar(256),
	"char" char(6),
	"numeric" numeric,
	"real" real,
	"double_precision" double precision,
	"json" json,
	"jsonb" jsonb,
	"time" time,
	"timestamp_date" timestamp,
	"date" date,
	"interval" interval,
	"point" "point",
	"line" "line",
	"mood_enum" "public"."mood_enum",
	"uuid" "uuid",
	"default" int default ${defaultValue}
    );`);
};

export const dropAllDataTypesTable = async (sql: SQL) => {
	await sql.unsafe('drop table if exists all_data_types;');
};

export const createAllArrayDataTypesTable = async (sql: SQL) => {
	await sql.unsafe(`DO $$ BEGIN
        CREATE TYPE "public"."mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');
       EXCEPTION
        WHEN duplicate_object THEN null;
       END $$;
   `);

	await sql.unsafe(`CREATE TABLE IF NOT EXISTS "public"."all_array_data_types" (
   "integer_array" integer[],
   "smallint_array" smallint[],
   "bigint_array" bigint[],
   "boolean_array" boolean[],
   "text_array" text[],
   "varchar_array" varchar(256)[],
   "char_array" char(6)[],
   "numeric_array" numeric[],
   "real_array" real[],
   "double_precision_array" double precision[],
   "json_array" json[],
   "jsonb_array" jsonb[],
   "time_array" time[],
   "timestamp_date_array" timestamptz[],
   "date_array" date[],
   "interval_array" interval[],
   "point_array" point[],
   "line_array" line[],
   "mood_enum_array" "public"."mood_enum"[],
   uuid_array "uuid"[]
);`);
};

export const createAllNdarrayDataTypesTable = async (sql: SQL) => {
	await sql.unsafe(`DO $$ BEGIN
        CREATE TYPE "public"."mood_enum" AS ENUM('sad', 'ok', 'happy', 'no,''"\`rm', 'mo''",\`}{od', 'mo,\`od');
       EXCEPTION
        WHEN duplicate_object THEN null;
       END $$;
   `);

	await sql.unsafe(`CREATE TABLE IF NOT EXISTS "public"."all_nd_array_data_types" (
   "integer_array_2d" integer[][],
   "json_array_2d" json[][],
   "jsonb_array_2d" jsonb[][],
   "time_array_2d" time[][],
   "timestamp_date_array_2d" timestamptz[][],
   "date_array_2d" date[][],
   "interval_array_2d" interval[][],
   "point_array_2d" point[][],
   "line_array_2d" line[][],
   "mood_enum_array_2d" "public"."mood_enum"[][],
   uuid_array_2d "uuid"[][]
);`);
};
