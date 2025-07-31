import type { BuildQueryConfig, SQLWrapper } from './sql';
import type { Identifier, IdentifierObject, Raw, UnsafeParamType, Value } from './types';

export abstract class Dialect implements BuildQueryConfig {
	abstract escapeParam(lastParamIdx: number, typeToCast: string): string;
	createEmptyParams(): any[] | Record<string, any>;
	createEmptyParams() {
		return [];
	}
	pushParams(
		params: any[] | Record<string, any>,
		param: any | any[] | Record<string, any>,
		lastParamIdx: number,
		mode: 'bulk' | 'single',
	): void;
	pushParams(params: any[], param: any | any[], _lastParamIdx: number, mode: 'bulk' | 'single' = 'bulk') {
		if (mode === 'bulk') params.push(...param);
		else params.push(param);
	}
	abstract escapeIdentifier(identifier: string): string;
	abstract checkIdentifierObject(object: IdentifierObject): void;

	// SQLValues
	abstract valueToSQL<V extends Value = Value>(params: {
		value: V;
		lastParamIdx: number;
		params: UnsafeParamType[] | Record<string, UnsafeParamType>;
		types: string[];
		colIdx: number;
		paramsCount: number;
	}): string;
}

export abstract class SQLChunk {
	abstract generateSQL(
		param: {
			dialect?: Dialect;
			lastParamIdx?: number;
		},
	): { sql: string; params?: any[] | Record<string, any> };
}

export class SQLQuery extends SQLChunk {
	constructor(readonly sqlWrapper: SQLWrapper, readonly dialect: Dialect) {
		super();
	}

	override generateSQL() {
		this.sqlWrapper.prepareQuery(this.dialect);
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);
		return { sql: query, params };
	}

	append(other: SQLQuery) {
		this.sqlWrapper.append(other.sqlWrapper);
	}

	toSQL() {
		return this.generateSQL();
	}
}

export class SQLCommonParam extends SQLChunk {
	constructor(
		readonly value: UnsafeParamType,
		readonly type: string = 'String',
	) {
		super();
	}

	generateSQL(
		{ dialect, lastParamIdx }: { dialect: Dialect; lastParamIdx: number },
	) {
		const params = dialect.createEmptyParams();
		dialect.pushParams(params, this.value, lastParamIdx + 1, 'single');
		return {
			sql: dialect.escapeParam(lastParamIdx + 1, this.type),
			params,
			paramsCount: 1,
		};
	}
}

export class SQLString extends SQLChunk {
	constructor(readonly value: string) {
		super();
	}

	generateSQL() {
		return { sql: this.value };
	}
}

export class SQLIdentifier<Q extends IdentifierObject> extends SQLChunk {
	constructor(readonly value: Identifier<Q>) {
		super();
	}

	objectToSQL(object: Q, dialect: Pick<BuildQueryConfig, 'checkIdentifierObject' | 'escapeIdentifier'>) {
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

export class SQLValues extends SQLChunk {
	constructor(readonly value: Value[][], readonly types: string[] = []) {
		super();
	}
	params: UnsafeParamType[] | Record<string, UnsafeParamType> = [];
	paramsCount: number = 0;

	generateSQL({ dialect, lastParamIdx }: { dialect: Dialect; lastParamIdx: number }) {
		this.params = dialect.createEmptyParams();
		this.paramsCount = 0;

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
			paramsCount: this.paramsCount,
		};
	}

	rowValuesToSQL(rowValues: Value[], dialect: Dialect, lastParamIdx: number) {
		if (Array.isArray(rowValues)) {
			if (rowValues.length === 0) {
				throw new Error(`array of values can't be empty.`);
			}

			return `(${
				rowValues
					.map((value, index) => {
						const sql = dialect.valueToSQL({
							value,
							lastParamIdx,
							params: this.params,
							types: this.types,
							colIdx: index,
							paramsCount: this.paramsCount,
						});
						this.paramsCount++;
						return sql;
					})
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

export class SQLRaw extends SQLChunk {
	constructor(readonly value: Raw) {
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

export class SQLDefault extends SQLChunk {
	generateSQL() {
		return { sql: 'default' };
	}
}
