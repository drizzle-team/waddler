import type { IdentifierObject } from './types';

export abstract class Dialect {
	abstract escapeParam(lastParamIdx: number): string;
	abstract escapeIdentifier(identifier: string): string;
	abstract checkIdentifierObject(object: IdentifierObject): void;

	// SQLValues
	abstract valueToSQL<V>(params: {
		value: V;
		escapeParam: (lastParamIdx: number) => string;
		lastParamIdx: number;
		params: V[];
	}): string;
}

export abstract class SQLParam {
	abstract generateSQL(
		param: {
			dialect?: Dialect;
			lastParamIdx?: number;
		},
	): { sql: string; params?: any[] };
}

export class SQLCommonParam extends SQLParam {
	constructor(private readonly value: any) {
		super();
	}

	generateSQL({ dialect, lastParamIdx }: { dialect: Dialect; lastParamIdx: number }): { sql: string; params: any[] } {
		return {
			sql: dialect.escapeParam(lastParamIdx + 1),
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

export type Identifier<Q extends IdentifierObject> =
	| string
	| string[]
	| Q
	| Q[];

export class SQLIdentifier<Q extends IdentifierObject> extends SQLParam {
	constructor(private readonly value: Identifier<Q>) {
		super();
	}

	objectToSQL(object: Q, dialect: Dialect) {
		dialect.checkIdentifierObject(object);

		const chunks: string[] = [];

		if (object.schema !== undefined) chunks.push(`${dialect.escapeIdentifier(object.schema)}`);
		if (object.table !== undefined) chunks.push(`${dialect.escapeIdentifier(object.table)}`);
		if (object.column !== undefined) chunks.push(`${dialect.escapeIdentifier(object.column)}`);
		const as = object.as === undefined ? '' : ` as ${dialect.escapeIdentifier(object.as)}`;

		return `${chunks.join('.')}${as}`;
	}

	generateSQL({ dialect }: { dialect: Dialect }) {
		if (typeof this.value === 'string') {
			return {
				sql: `${dialect.escapeIdentifier(this.value)}`,
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
					chunks.push(dialect.escapeIdentifier(val));
				} else if (typeof val === 'object' && val !== null) {
					chunks.push(this.objectToSQL(val, dialect));
				} else {
					throw new Error(
						`you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`,
					);
				}
			}

			return { sql: chunks.join(', ') };
		}

		if (typeof this.value === 'object' && this.value !== null) {
			return { sql: this.objectToSQL(this.value, dialect) };
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

export class SQLValues<Value> extends SQLParam {
	constructor(private readonly value: Value[][]) {
		super();
	}
	protected params: Value[] = [];

	generateSQL({ dialect, lastParamIdx }: { dialect: Dialect; lastParamIdx: number }) {
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
			.map((rowValues) => this.rowValuesToSQL(rowValues, dialect, lastParamIdx))
			.join(', ');

		return {
			sql,
			params: this.params,
		};
	}

	rowValuesToSQL(rowValues: Value[], dialect: Dialect, lastParamIdx: number) {
		if (Array.isArray(rowValues)) {
			if (rowValues.length === 0) {
				throw new Error(`array of values can't be empty.`);
			}

			return `(${
				rowValues
					.map((value) =>
						dialect.valueToSQL<Value>({ value, escapeParam: dialect.escapeParam, lastParamIdx, params: this.params })
					)
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
