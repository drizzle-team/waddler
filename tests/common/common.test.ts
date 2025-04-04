import { expect, test } from 'vitest';
import { PgDialect } from '../../src/pg-core/dialect.ts';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../../src/sql-template-params.ts';
import { SQLWrapper } from '../../src/sql.ts';
import type { SQLParamType } from '../../src/types.ts';

const templateFunction = (strings: TemplateStringsArray, ...params: SQLParamType[]) => {
	return { strings, params };
};
const dialect = new PgDialect();

test('SQLWrapper with template params(SQLIdentifier, SQLValues) test', () => {
	const sql = new SQLWrapper();
	const templateParams = templateFunction`insert into ${new SQLIdentifier('users')} values ${new SQLValues<any>([[
		1,
		new SQLDefault(),
	]])};`;
	sql.with({ templateParams }).prepareQuery(dialect);
	const { query, params } = sql.getQuery();
	expect(query).toBe('insert into "users" values ($1, default);');
	expect(params).toEqual([1]);
});

test('SQLWrapper with template params(SQLRaw) test', () => {
	const sql = new SQLWrapper();

	const defaultValue = 3;
	const asColumn: string = 'case_column';
	const asClause = asColumn === '' ? new SQLRaw('') : new SQLRaw(` as ${asColumn}`);

	const templateParams = templateFunction`select ${new SQLRaw(
		`case when "default" = ${defaultValue} then 'column=default' else 'column!=default' end`,
	)}${asClause} from all_data_types;`;

	sql.with({ templateParams }).prepareQuery(dialect);
	const { query, params } = sql.getQuery();
	expect(query).toEqual(
		`select case when "default" = 3 then 'column=default' else 'column!=default' end as case_column from all_data_types;`,
	);
	expect(params.length).toEqual(0);
});

test('SQLWrapper with template params(SQLIdentifier, SQLDefault along with usual params) test', () => {
	const sql = new SQLWrapper();
	const date = new Date('2024-10-31T14:25:29.425Z');
	const templateParams = templateFunction`insert into ${new SQLIdentifier(
		'users',
	)} values (${new SQLDefault()}, ${1}, ${'2'}, ${BigInt(1)}, ${date}, ${true});`;
	sql.with({ templateParams }).prepareQuery(dialect);
	const { query, params } = sql.getQuery();
	expect(query).toBe('insert into "users" values (default, $1, $2, $3, $4, $5);');
	expect(params).toEqual([1, '2', BigInt(1), date, true]);
});

test('SQLWrapper with raw params test', () => {
	const sql = new SQLWrapper();
	const date = new Date('2024-10-31T14:25:29.425Z');
	const rawParams = {
		query: 'insert into users values (default, $1, $2, $3, $4, $5);',
		params: [1, '2', BigInt(1), date, true],
	};
	sql.with({ rawParams });
	const { query, params } = sql.getQuery();
	expect(query).toBe('insert into users values (default, $1, $2, $3, $4, $5);');
	expect(params).toEqual([1, '2', BigInt(1), date, true]);
});
