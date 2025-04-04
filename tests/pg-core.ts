import { expect } from 'vitest';
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

export const tests = {
	'all_types_in_sql.unsafe': {
		test: async (sql: SQL) => {
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
				// sql.default,
			];

			await sql.unsafe(
				`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, default);`,
				values,
				{ rowMode: 'object' },
			);

			const res = await sql.unsafe(`select * from all_data_types;`);

			const expectedRes = tests['all_types_in_sql.unsafe'].expectedRes;

			expect(res[0]).toStrictEqual(expectedRes);

			// same as select query as above but with rowMode: "array"
			const arrayResult = await sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
			expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
		},
		expectedRes: {},
		expectedResDefault: {
			integer: 1,
			smallint: 10,
			bigint: String(BigInt('9007199254740992') + BigInt(1)),
			serial: 1,
			smallserial: 10,
			bigserial: String(BigInt('9007199254740992') + BigInt(1)),
			boolean: true,
			text: 'qwerty',
			varchar: 'qwerty',
			char: 'qwerty',
			numeric: '20.4',
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
			timestamp_date: new Date('2024-10-31T14:25:29.425'),
			date: new Date('2024-10-30T22:00:00.000Z'),
			interval: '1 day',
			point: { x: 1, y: 2 }, // [1, 2]
			line: '{1,2,3}', // [1, 2, 3]
			mood_enum: `no,'"\`rm`,
			uuid: '550e8400-e29b-41d4-a716-446655440000',
			default: 3,
		},
	},
};
