import { Dialect, SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { Identifier, IdentifierObject, Raw, Value, Values } from '../types.ts';

export type SnowflakeIdentifierObject = IdentifierObject & {
	database?: string;
};

class SnowflakeSQLIdentifier extends SQLIdentifier<SnowflakeIdentifierObject> {
	override objectToSQL(
		object: SnowflakeIdentifierObject,
		dialect: Pick<Dialect, 'checkIdentifierObject' | 'escapeIdentifier'>,
	) {
		dialect.checkIdentifierObject(object);

		const chunks: string[] = [];

		if (object.database !== undefined) chunks.push(`${dialect.escapeIdentifier(object.database)}`);
		if (object.schema !== undefined) chunks.push(`${dialect.escapeIdentifier(object.schema)}`);
		if (object.table !== undefined) chunks.push(`${dialect.escapeIdentifier(object.table)}`);
		if (object.column !== undefined) chunks.push(`${dialect.escapeIdentifier(object.column)}`);
		const as = object.as === undefined ? '' : ` as ${dialect.escapeIdentifier(object.as)}`;

		return `${chunks.join('.')}${as}`;
	}
}

export class SnowflakeDialect extends Dialect {
	escapeParam(): string {
		return '?';
	}

	escapeIdentifier(identifier: string): string {
		return `"${identifier.replaceAll('"', '""')}"`;
	}

	checkIdentifierObject(object: SnowflakeIdentifierObject) {
		if (Object.values(object).includes(undefined!)) {
			throw new Error(
				`you can't specify undefined parameters. maybe you want to omit it?`,
			);
		}

		if (Object.keys(object).length === 0) {
			throw new Error(`you need to specify at least one parameter.`);
		}

		if (object.database !== undefined && object.schema === undefined) {
			throw new Error(
				`you can't specify "database" without "schema" property.`,
			);
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
			throw new Error(
				`you can't specify only "as" property. you have to specify "column" or "table" property along with "as".`,
			);
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
			!['string', 'undefined'].includes(typeof object.database)
			|| !['string', 'undefined'].includes(typeof object.schema)
			|| !['string', 'undefined'].includes(typeof object.table)
			|| !['string', 'undefined'].includes(typeof object.column)
			|| !['string', 'undefined'].includes(typeof object.as)
		) {
			throw new Error(
				"object properties 'database', 'schema', 'table', 'column', 'as' should be of string type or omitted.",
			);
		}
	}

	valueToSQL(
		{ value, params }: {
			value: Value;
			params: Value[] | Record<string, any>;
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

export const SQLFunctions = {
	identifier: (value: Identifier<SnowflakeIdentifierObject>) => {
		return new SnowflakeSQLIdentifier(value);
	},
	values: (value: Values) => {
		return new SQLValues(value);
	},
	raw: (value: Raw) => {
		return new SQLRaw(value);
	},
	default: new SQLDefault(),
};
