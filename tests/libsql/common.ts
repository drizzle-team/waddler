import { createAllDataTypesTable, dropAllDataTypesTable } from 'tests/sqlite-core';
import { describe, expect, test } from 'vitest';
import type { LibsqlSQL } from '~/libsql/driver-core';

export const libsqlTests = (driver?: string) => {
	describe('libsql_tests', () => {
		// UNSAFE-------------------------------------------------------------------
		test.sequential<{ sql: LibsqlSQL }>('all types in sql.unsafe test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

			const values = [
				2147483647,
				9007199254740991, // BigInt('9007199254740992') + BigInt(1), // if you want to work with bigint, you should set client option intMode to 'bigint',
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
				9007199254740991, // BigInt('9007199254740992') + BigInt(1), // if you want to work with bigint, you should set client option intMode to 'bigint',
				Buffer.from('qwerty'),
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

			await ctx.sql.unsafe(
				`insert into all_data_types values (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
				values,
			).run();

			await ctx.sql.unsafe(`select 1;`);
			const res = await ctx.sql.unsafe(`select * from all_data_types;`);

			const blob_buffer = driver === 'wasm'
				? new Uint8Array(Buffer.from('qwerty'))
				: new Uint8Array(Buffer.from('qwerty')).buffer;

			const expectedRes = {
				integer_number: 2147483647,
				integer_bigint: 9007199254740991,
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
				blob_bigint: 9007199254740991,
				blob_buffer,
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

			expect(res[0]).toStrictEqual(expectedRes);

			// same as select query as above but with rowMode: "array"
			const arrayResult = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();
			expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
		});

		// sql.values
		// ALL TYPES-------------------------------------------------------------------
		test.sequential<{ sql: LibsqlSQL }>('all types in sql.values test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

			const allDataTypesValues = [
				2147483647,
				9007199254740991, // BigInt('9007199254740992') + BigInt(1), // if you want to work with bigint, you should set client option intMode to 'bigint',
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
				9007199254740991, // BigInt('9007199254740992') + BigInt(1), // if you want to work with bigint, you should set client option intMode to 'bigint',
				Buffer.from('qwerty'),
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

			const blob_buffer = driver === 'wasm'
				? new Uint8Array(Buffer.from('qwerty'))
				: new Uint8Array(Buffer.from('qwerty')).buffer;
			const expectedRes = [
				2147483647,
				9007199254740991,
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
				9007199254740991,
				blob_buffer,
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

			await ctx.sql`insert into ${ctx.sql.identifier('all_data_types')} values ${ctx.sql.values([allDataTypesValues])};`
				.run();

			const res = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' }).all();

			expect(res[0]).toStrictEqual(expectedRes);
		});
	});
};
