import { Dialect, SQLDefault } from '../../sql-template-params.ts';
import type { UnsafeParamType, Value } from '../../types.ts';

export type MySQLIdentifierObject = {
	table?: string;
	column?: string;
	as?: string;
};

export class MySQLDialect extends Dialect {
	escapeParam(): string {
		return `?`;
	}

	escapeIdentifier(identifier: string): string {
		return `\`${identifier}\``;
	}

	checkIdentifierObject(object: MySQLIdentifierObject) {
		if (Object.values(object).includes(undefined!)) {
			throw new Error(
				`you can't specify undefined parameters. maybe you want to omit it?`,
			);
		}

		if (Object.keys(object).length === 0) {
			throw new Error(`you need to specify at least one parameter.`);
		}

		if (Object.keys(object).length === 1 && object.as !== undefined) {
			throw new Error(
				`you can't specify only "as" property. you have to specify "column" or "table" property along with "as".`,
			);
		}

		if (
			!['string', 'undefined'].includes(typeof object.table)
			|| !['string', 'undefined'].includes(typeof object.column)
			|| !['string', 'undefined'].includes(typeof object.as)
		) {
			throw new Error(
				"object properties 'table', 'column', 'as' should be of string type or omitted.",
			);
		}
	}

	// SQLValues
	valueToSQL(
		{ value, params }: {
			value: Value;
			params: UnsafeParamType[];
		},
	): string {
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
			|| Buffer.isBuffer(value)
		) {
			params.push(value);
			return this.escapeParam();
		}

		if (typeof value === 'object') {
			params.push(JSON.stringify(value));
			return this.escapeParam();
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
	}
}
