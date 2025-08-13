import { Dialect, SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { Identifier, IdentifierObject, Raw, Values } from '../types.ts';

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
	valueToSQL<DuckdbValue>({ value }: { value: DuckdbValue }): string {
		if (value instanceof SQLDefault) {
			return value.generateSQL().sql;
		}

		if (
			typeof value === 'number'
			|| typeof value === 'bigint'
			|| typeof value === 'boolean'
			|| value === null
		) {
			return `${value}`;
		}

		if (value instanceof Date) {
			return `'${value.toISOString()}'`;
		}

		if (typeof value === 'string') {
			return `'${value.replaceAll("'", "''")}'`;
		}

		if (Array.isArray(value)) {
			return `[${value.map((arrayValue) => this.valueToSQL({ value: arrayValue }))}]`;
		}

		if (typeof value === 'object') {
			return `'${JSON.stringify(value)}'`;
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
