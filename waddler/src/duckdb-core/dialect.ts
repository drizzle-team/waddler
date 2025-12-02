import { Dialect, SQLDefault, SQLIdentifier, SQLQuery, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, Values } from '../types.ts';

export class DuckdbDialect extends Dialect {
	escapeParam(lastParamIdx: number): string {
		return `$${lastParamIdx}`;
	}

	escapeIdentifier(identifier: string): string {
		return `"${identifier}"`;
	}

	checkIdentifierObject(object: IdentifierObject) {
		if (Object.values(object).includes(undefined!)) {
			throw new Error(
				`you can't specify undefined parameters. maybe you want to omit it?`,
			);
		}

		if (Object.keys(object).length === 0) {
			throw new Error(`you need to specify at least one parameter.`);
		}

		if (
			object.schema !== undefined
			&& object.table === undefined
			&& object.column !== undefined
		) {
			throw new Error(
				`you can't specify only "schema" and "column" properties, you need also specify "table".`,
			);
		}

		if (Object.keys(object).length === 1 && object.as !== undefined) {
			throw new Error(`you can't specify only "as" property.`);
		}

		if (
			object.as !== undefined
			&& object.column === undefined
			&& object.table === undefined
		) {
			throw new Error(
				`you have to specify "column" or "table" property along with "as".`,
			);
		}

		if (
			!['string', 'undefined'].includes(typeof object.schema)
			|| !['string', 'undefined'].includes(typeof object.table)
			|| !['string', 'undefined'].includes(typeof object.column)
			|| !['string', 'undefined'].includes(typeof object.as)
		) {
			throw new Error(
				"object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.",
			);
		}
	}

	// SQLValues
	valueToSQL<DuckdbValue>({ value }: { value: DuckdbValue }): { sql: string; addParamsCount?: number } {
		if (value instanceof SQLDefault) {
			return { sql: value.generateSQL().sql };
		}

		if (value instanceof SQLRaw) {
			return { sql: value.generateSQL().sql };
		}

		if (
			typeof value === 'number'
			|| typeof value === 'bigint'
			|| typeof value === 'boolean'
			|| value === null
		) {
			return { sql: `${value}` };
		}

		if (value instanceof Date) {
			return { sql: `'${value.toISOString()}'` };
		}

		if (typeof value === 'string') {
			return { sql: `'${value.replaceAll("'", "''")}'` };
		}

		if (Array.isArray(value)) {
			return { sql: `[${value.map((arrayValue) => this.valueToSQL({ value: arrayValue }).sql)}]` };
		}

		if (typeof value === 'object') {
			return { sql: `'${JSON.stringify(value)}'` };
			// TODO: revise
			// object case
			// throw new Error(
			// 	"value can't be object. you can't specify [ [ {...}, ...], ...] as parameter for sql.values.",
			// );
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
	}
}

// export type DuckdbValue = Exclude<Value, Buffer | JSONArray>;

// export type DuckdbValues = Value[][];

export const SQLFunctions = {
	identifier: (value: Identifier<IdentifierObject>) => {
		return new SQLIdentifier(value);
	},
	values: (value: Values) => {
		return new SQLValues(value);
	},
	raw: (value: Raw) => {
		return new SQLRaw(value);
	},
	default: new SQLDefault(),
};

export interface DuckdbSQLQuery extends Pick<SQL, 'identifier' | 'raw' | 'default' | 'values'> {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new DuckdbDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as DuckdbSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };
