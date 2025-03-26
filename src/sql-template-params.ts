export abstract class SQLParam {
	abstract generateSQL(lastParamIdx?: number): { sql: string; params?: any[] };
}

export abstract class SQLCommonParam extends SQLParam {
	constructor(private readonly value: any) {
		super();
	}

	abstract escapeParam(lastParamIdx: number): string;
	generateSQL(lastParamIdx: number): { sql: string; params: any[] } {
		return {
			sql: this.escapeParam(lastParamIdx + 1),
			params: [this.value],
		};
	}
}

export class SQLString extends SQLParam {
	constructor(private readonly value: string) {
		super();
	}

	generateSQL() {
		return { sql: this.value };
	}
}

export type IdentifierObject = {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
};

export type Identifier<Q extends IdentifierObject> =
	| string
	| string[]
	| Q
	| Q[];

export abstract class SQLIdentifier<Q extends IdentifierObject> extends SQLParam {
	constructor(private readonly value: Identifier<Q>) {
		super();
	}

	abstract escapeIdentifier(val: string): string;
	abstract checkObject(val: Q): void;

	objectToSQL(object: Q) {
		this.checkObject(object);

		const chunks: string[] = [];

		if (object.schema !== undefined) chunks.push(`${this.escapeIdentifier(object.schema)}`);
		if (object.table !== undefined) chunks.push(`${this.escapeIdentifier(object.table)}`);
		if (object.column !== undefined) chunks.push(`${this.escapeIdentifier(object.column)}`);
		const as = object.as === undefined ? '' : ` as ${this.escapeIdentifier(object.as)}`;

		return `${chunks.join('.')}${as}`;
	}

	generateSQL() {
		if (typeof this.value === 'string') {
			return {
				sql: `${this.escapeIdentifier(this.value)}`,
			};
		}

		// TODO: revise: this does not ensure types structure in runtime
		if (Array.isArray(this.value)) {
			if (this.value.length === 0) {
				throw new Error(
					`you can't specify empty array as parameter for sql.identifier.`,
				);
			}

			const chunks: string[] = [];

			for (const val of this.value) {
				if (Array.isArray(val)) {
					throw new Error(
						`you can't specify array of arrays as parameter for sql.identifier.`,
					);
				}

				if (typeof val === 'string') {
					chunks.push(this.escapeIdentifier(val));
				} else if (typeof val === 'object' && val !== null) {
					chunks.push(this.objectToSQL(val));
				} else {
					throw new Error(
						`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
					);
				}
			}

			return { sql: chunks.join(', ') };
		}

		if (typeof this.value === 'object' && this.value !== null) {
			return { sql: this.objectToSQL(this.value) };
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

export abstract class SQLValues<Value> extends SQLParam {
	constructor(private readonly value: Value[][]) {
		super();
	}
	protected params: Value[] = [];

	generateSQL(lastParamIdx: number) {
		if (!Array.isArray(this.value)) {
			if (this.value === null) {
				throw new Error(`you can't specify null as parameter for sql.values.`);
			}
			throw new Error(
				`you can't specify ${typeof this.value} as parameter for sql.values.`,
			);
		}

		if (this.value.length === 0) {
			throw new Error(
				`you can't specify empty array as parameter for sql.values.`,
			);
		}
		const sql = this.value
			.map((rowValues) => this.rowValuesToSQL(rowValues, lastParamIdx))
			.join(', ');

		return {
			sql,
			params: this.params,
		};
	}

	rowValuesToSQL(rowValues: Value[], lastParamIdx: number) {
		if (Array.isArray(rowValues)) {
			if (rowValues.length === 0) {
				throw new Error(`array of values can't be empty.`);
			}

			return `(${
				rowValues
					.map((val) => this.valueToSQL(val, this.escapeParam, lastParamIdx))
					.join(', ')
			})`;
		}

		if (rowValues === null) {
			throw new Error(
				`you can't specify array of null as parameter for sql.values.`,
			);
		}
		throw new Error(
			`you can't specify array of ${typeof rowValues} as parameter for sql.values.`,
		);
	}

	// PostgreSQL and DuckDB implementations below can and should be overridden if your valueToSQL method uses the escapeParam method.
	escapeParam(lastParamIdx: number): string {
		return `$${lastParamIdx}`;
	}

	abstract valueToSQL(value: Value, escapeParam: (lastParamIdx: number) => string, lastParamIdx: number): string;
}

export type Raw = string | number | boolean | bigint;
export class SQLRaw extends SQLParam {
	constructor(private readonly value: Raw) {
		super();
	}

	generateSQL() {
		if (
			typeof this.value === 'number'
			|| typeof this.value === 'bigint'
			|| typeof this.value === 'string'
			|| typeof this.value === 'boolean'
		) {
			return { sql: `${this.value}` };
		}

		if (typeof this.value === 'object') {
			throw new Error(
				"you can't specify array, object or null as parameter for sql.raw.",
			);
		}

		if (this.value === undefined) {
			throw new Error(
				"you can't specify undefined as parameter for sql.raw, maybe you mean using sql.default?",
			);
		}

		if (typeof this.value === 'symbol') {
			throw new Error("you can't specify symbol as parameter for sql.raw.");
		}

		throw new Error("you can't specify function as parameter for sql.raw.");
	}
}

export class SQLDefault extends SQLParam {
	generateSQL() {
		return { sql: 'default' };
	}
}
