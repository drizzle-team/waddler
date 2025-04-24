import { afterEach, describe, expect, test } from 'vitest';
import type { SQL } from '../../src/sql.ts';
import {
	createAllArrayDataTypesTable,
	createAllDataTypesTable,
	createAllNdarrayDataTypesTable,
	defaultValue,
	dropAllArrayDataTypesTable,
	dropAllDataTypesTable,
	dropAllNdarrayDataTypesTable,
} from './pg-core.ts';

export const neonTests = () => {
	describe('neon_tests', () => {
		afterEach<{ sql: SQL }>(async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await dropAllArrayDataTypesTable(ctx.sql);
			await dropAllNdarrayDataTypesTable(ctx.sql);
		});

		// UNSAFE-------------------------------------------------------------------
		test<{ sql: SQL }>('all types in sql.unsafe test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

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
				{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				'14:25:29.425',
				new Date('2024-10-31T14:25:29.425Z'),
				'2024-10-31',
				'1 day',
				'(1,2)',
				'{1,2,3}',
				`no,'"\`rm`,
				'550e8400-e29b-41d4-a716-446655440000',
				Buffer.from('qwerty'),
				// ctx.sql.default,
			];

			await ctx.sql.unsafe(
				`insert into all_data_types values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, default);`,
				values,
				{ rowMode: 'object' },
			);

			const res = await ctx.sql.unsafe(`select * from all_data_types;`);

			const dateWithoutTime = new Date(date);
			dateWithoutTime.setUTCHours(0, 0, 0, 0);
			const expectedRes = {
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
				timestamp_date: new Date('2024-10-31T14:25:29.425Z'),
				date: new Date('2024-10-30T22:00:00.000Z'),
				interval: '1 day',
				point: { x: 1, y: 2 }, // [1, 2]
				line: '{1,2,3}', // [1, 2, 3]
				mood_enum: `no,'"\`rm`,
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				bytea: Buffer.from('qwerty'),
				default: defaultValue,
			};

			expect(res[0]).toStrictEqual(expectedRes);

			// same as select query as above but with rowMode: "array"
			const arrayResult = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });
			expect(arrayResult[0]).toStrictEqual(Object.values(expectedRes));
		});

		// sql.values
		// ALL TYPES-------------------------------------------------------------------
		test<{ sql: SQL }>('all types in sql.values test', async (ctx) => {
			await dropAllDataTypesTable(ctx.sql);
			await createAllDataTypesTable(ctx.sql);

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
				{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				},
				'14:25:29.425',
				new Date('2024-10-31T14:25:29.425Z'),
				'2024-10-31',
				'1 day',
				'(1,2)',
				'{1,2,3}',
				`no,'"\`rm`,
				'550e8400-e29b-41d4-a716-446655440000',
				Buffer.from('qwerty'),
				ctx.sql.default,
			];

			const expectedRes = [
				1,
				10,
				String(BigInt('9007199254740992') + BigInt(1)),
				1,
				10,
				String(BigInt('9007199254740992') + BigInt(1)),
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
				new Date('2024-10-31T14:25:29.425Z'),
				new Date('2024-10-30T22:00:00.000Z'),
				'1 day',
				{ x: 1, y: 2 }, // [1, 2],
				'{1,2,3}', // [1, 2, 3],
				`no,'"\`rm`,
				'550e8400-e29b-41d4-a716-446655440000',
				Buffer.from('qwerty'),
				defaultValue,
			];

			await ctx.sql`insert into ${ctx.sql.identifier('all_data_types')} values ${
				ctx.sql.values([allDataTypesValues])
			};`;

			const res = await ctx.sql.unsafe(`select * from all_data_types;`, [], { rowMode: 'array' });

			expect(res[0]).toStrictEqual(expectedRes);
		});

		test<{ sql: SQL }>('all array types in sql.values test', async (ctx) => {
			await dropAllArrayDataTypesTable(ctx.sql);
			await createAllArrayDataTypesTable(ctx.sql);

			const date = new Date('2024-10-31T14:25:29.425Z');

			const allArrayDataTypesValues = [
				[1],
				[10],
				[BigInt('9007199254740992') + BigInt(1)],
				[true],
				['qwerty'],
				['qwerty'],
				['qwerty'],
				[20.4],
				[20.4],
				[20.4],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
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
				[String(BigInt('9007199254740992') + BigInt(1))],
				[true],
				['qwerty'],
				['qwerty'],
				['qwerty'],
				[20.4],
				[20.4],
				[20.4],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				[{
					name: 'alex',
					age: 26,
					bookIds: [1, 2, 3],
					vacationRate: 2.5,
					aliases: ['sasha', 'sanya'],
					isMarried: true,
				}],
				['14:25:29.425'],
				[date],
				[new Date('2024-10-30T22:00:00.000Z')],
				`{"1 day"}`, // `{"1 day"}`,
				[{ x: 1, y: 2 }], // [[1, 2]], [{ x: 1, y: 2 }],
				'{"{1.1,2,3}","{4.4,5,6}"}', // [[1.1, 2, 3], [4.4, 5, 6]], // ['{1.1,2,3}', '{4.4,5,6}'], //'{"{1.1,2,3}","{4.4,5,6}"}',
				'{ok,happy,"no,\'\\"`rm"}', // ['ok', 'happy', `no,'"\`rm`],
				['550e8400-e29b-41d4-a716-446655440000'],
			];

			const query = ctx.sql`insert into ${ctx.sql.identifier('all_array_data_types')} values ${
				ctx.sql.values([allArrayDataTypesValues])
			};`;
			// console.log(query.toSQL());
			await query;

			const res = await ctx.sql.unsafe(`select * from all_array_data_types;`, [], { rowMode: 'array' });

			expect(res[0]).toStrictEqual(expectedRes);
		});

		test<{ sql: SQL }>('all nd-array types in sql.values test', async (ctx) => {
			await dropAllNdarrayDataTypesTable(ctx.sql);
			await createAllNdarrayDataTypesTable(ctx.sql);

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
				[['1 days'], ['1 days']], // [['1 days'], ['1 days']],
				[['(1,2)'], ['(1,2)']],
				[['{1.1,2,3}', '{4.4,5,6}'], ['{1.1,2,3}', '{4.4,5,6}']],
				[['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
				[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
			];

			const expectedRes1 = [
				[[1, 2], [2, 3]],
				[[json], [json]],
				[[json], [json]],
				[['14:25:29.425'], ['14:25:29.425']],
				[[date], [date]],
				[[new Date('2024-10-30T22:00:00.000Z')], [new Date('2024-10-30T22:00:00.000Z')]],
				`{{"1 day"},{"1 day"}}`, // `{{"1 day"},{"1 day"}}`,
				[[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]], // [[[1, 2]], [[1, 2]]], // [[{ x: 1, y: 2 }], [{ x: 1, y: 2 }]],
				'{{"{1.1,2,3}","{4.4,5,6}"},{"{1.1,2,3}","{4.4,5,6}"}}', // [[[1.1, 2, 3], [4.4, 5, 6]], [[1.1, 2, 3], [4.4, 5, 6]]], // '{{"{1.1,2,3}","{4.4,5,6}"},{"{1.1,2,3}","{4.4,5,6}"}}',
				'{{ok,happy,"no,\'\\"`rm"},{ok,happy,"no,\'\\"`rm"}}', // [['ok', 'happy', `no,'"\`rm`], ['ok', 'happy', `no,'"\`rm`]],
				[['550e8400-e29b-41d4-a716-446655440000'], ['550e8400-e29b-41d4-a716-446655440000']],
			];

			await ctx.sql`insert into ${ctx.sql.identifier('all_nd_array_data_types')} values ${
				ctx.sql.values([allArrayDataTypesValues])
			};`;

			const res = await ctx.sql.unsafe(`select * from all_nd_array_data_types;`, [], { rowMode: 'array' });

			expect(res[0]).toStrictEqual(expectedRes1);
		});

		// sql.stream: not implemented yet
	});
};
