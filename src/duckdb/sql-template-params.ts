import { SQLDefault, SQLIdentifier, SQLValues } from '../sql-template-params.ts';

export type DuckdbIdentifier =
	| string
	| string[]
	| { schema?: string; table?: string; column?: string; as?: string }
	| {
		schema?: string;
		table?: string;
		column?: string;
		as?: string;
	}[];

export class DuckdbSQLIdentifier extends SQLIdentifier {
	constructor(private readonly value: DuckdbIdentifier) {
		super();
	}

	// TODO: @AlexBlokh do error's text
	static checkObject(object: {
		schema?: string;
		table?: string;
		column?: string;
		as?: string;
	}) {
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

	static objectToSQL(object: {
		schema?: string;
		table?: string;
		column?: string;
		as?: string;
	}) {
		DuckdbSQLIdentifier.checkObject(object);

		const schema = object.schema === undefined ? '' : `"${object.schema}".`;
		const table = object.table === undefined ? '' : `"${object.table}"`;
		const column = object.column === undefined ? '' : `."${object.column}"`;
		const as = object.as === undefined ? '' : ` as "${object.as}"`;

		return `${schema}${table}${column}${as}`.replace(/^\.|\.$/g, '');
	}

	generateSQL() {
		if (typeof this.value === 'string') {
			return { sql: `"${this.value}"` };
		}

		if (Array.isArray(this.value)) {
			if (this.value.length === 0) {
				throw new Error(
					`you can't specify empty array as parameter for sql.identifier.`,
				);
			}

			if (this.value.every((val) => typeof val === 'string')) {
				return { sql: `"${this.value.join('", "')}"` };
			}

			if (
				this.value.every(
					(val) => typeof val === 'object' && !Array.isArray(val) && val !== null,
				)
			) {
				return {
					sql: `${
						this.value
							.map((element) => DuckdbSQLIdentifier.objectToSQL(element))
							.join(', ')
					}`,
				};
			}

			let areThereAnyArrays = false;
			for (const val of this.value) {
				if (Array.isArray(val)) {
					areThereAnyArrays = true;
					break;
				}
			}
			if (areThereAnyArrays) {
				throw new Error(
					`you can't specify array of arrays as parameter for sql.identifier.`,
				);
			}

			throw new Error(
				`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
			);
		}

		if (typeof this.value === 'object' && this.value !== null) {
			// typeof this.value === "object"
			return { sql: DuckdbSQLIdentifier.objectToSQL(this.value) };
		}

		if (this.value === null) {
			throw new Error(
				`you can't specify null as parameter for sql.identifier.`,
			);
		}

		throw new Error(
			`you can't specify ${typeof this.value} as parameter for sql.identifier.`,
		);
	}
}

export class DuckdbSQLDefault extends SQLDefault {
	generateSQL() {
		return { sql: 'default' };
	}
}

export type Value = string | number | bigint | boolean | Date | DuckdbSQLDefault | null | Value[];
export type DuckdbValues = Value[][];
export class DuckdbSQLValues extends SQLValues {
	constructor(private readonly value: DuckdbValues) {
		super();
	}

	generateSQL() {
		if (!Array.isArray(this.value)) {
			if (this.value === null) throw new Error(`you can't specify null as parameter for sql.values.`);
			throw new Error(`you can't specify ${typeof this.value} as parameter for sql.values.`);
		}

		if (this.value.length === 0) {
			throw new Error(`you can't specify empty array as parameter for sql.values.`);
		}

		return {
			sql: this.value
				.map((val) => DuckdbSQLValues.arrayToSQL(val))
				.join(', '),
		};
	}

	private static arrayToSQL(array: Value[]) {
		if (Array.isArray(array)) {
			if (array.length === 0) {
				throw new Error(`array of values can't be empty.`);
			}

			return `(${array.map((val) => DuckdbSQLValues.valueToSQL(val)).join(', ')})`;
		}

		if (array === null) throw new Error(`you can't specify array of null as parameter for sql.values.`);
		throw new Error(`you can't specify array of ${typeof array} as parameter for sql.values.`);
	}

	private static valueToSQL(value: Value): string {
		if (
			typeof value === 'number'
			|| typeof value === 'bigint'
			|| typeof value === 'boolean'
			|| value === null
		) {
			return `${value}`;
		}

		if (value instanceof DuckdbSQLDefault) {
			return value.generateSQL().sql;
		}

		if (value instanceof Date) {
			return `'${value.toISOString()}'`;
		}

		if (typeof value === 'string') {
			return `'${value}'`;
		}

		if (Array.isArray(value)) {
			return `[${value.map((arrayValue) => DuckdbSQLValues.valueToSQL(arrayValue))}]`;
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
