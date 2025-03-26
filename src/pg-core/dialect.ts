import { SQLCommonParam, SQLDefault, SQLIdentifier, SQLValues } from '../sql-template-params.ts';
import type { JSONObject } from '../types.ts';

export abstract class SQLValuesDriver {
	abstract mapToDriver(value: any): any;
}

export class PgSQLCommonParam extends SQLCommonParam {
	override escapeParam(lastParamIdx: number): string {
		return `$${lastParamIdx}`;
	}
}

export type PgIdentifierObject = {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
};

export class PgSQLIdentifier extends SQLIdentifier<PgIdentifierObject> {
	override escapeIdentifier(val: string): string {
		return `"${val}"`;
	}

	checkObject(object: PgIdentifierObject) {
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
export type PgValues = Value[][];
export class PgSQLValues extends SQLValues<Value> {
	override escapeParam(lastParamIdx: number): string {
		return `$${lastParamIdx}`;
	}

	valueToSQL(value: Value, escapeParam: (lastParamIdx: number) => string, lastParamIdx: number): string {
		if (value instanceof SQLDefault) {
			return value.generateSQL().sql;
		}

		if (
			typeof value === 'number'
			|| typeof value === 'bigint'
			|| typeof value === 'boolean'
			|| typeof value === 'string'
			|| value === null
			|| value instanceof Date
			|| Array.isArray(value)
			|| typeof value === 'object'
		) {
			this.params.push(value);
			return escapeParam(lastParamIdx + this.params.length);
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
	}
}
