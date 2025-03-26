import { SQLCommonParam, SQLDefault, SQLIdentifier, SQLValues } from '../sql-template-params.ts';
import type { JSONObject } from '../types.ts';

export class DuckdbSQLCommonParam extends SQLCommonParam {
	override escapeParam(lastParamIdx: number): string {
		return `$${lastParamIdx}`;
	}
}

export type DuckdbIdentifierObject = {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
};

export class DuckdbSQLIdentifier extends SQLIdentifier<DuckdbIdentifierObject> {
	override escapeIdentifier(val: string): string {
		return `"${val}"`;
	}

	checkObject(object: DuckdbIdentifierObject) {
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
}

export type Value =
	| string
	| number
	| bigint
	| boolean
	| Date
	| SQLDefault
	| null
	| JSONObject
	| Value[];
export type DuckdbValues = Value[][];
export class DuckdbSQLValues extends SQLValues<Value> {
	constructor(value: DuckdbValues) {
		super(value);
	}

	valueToSQL(value: Value): string {
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
			return `'${value}'`;
		}

		if (Array.isArray(value)) {
			return `[${value.map((arrayValue) => this.valueToSQL(arrayValue))}]`;
		}

		if (typeof value === 'object') {
			// object case
			throw new Error(
				"value can't be object. you can't specify [ [ {...}, ...], ...] as parameter for sql.values.",
			);
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
	}
}
