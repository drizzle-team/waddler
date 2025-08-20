import { Dialect, SQLCommonParam, SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../../sql-template-params.ts';
import type { Identifier, IdentifierObject, Raw, UnsafeParamType, Value, Values } from '../../types.ts';
// import { makeCockroachArray } from './utils.ts';

export class CockroachDialect extends Dialect {
	escapeParam(lastParamIdx: number, typeToCast?: string): string {
		return `$${lastParamIdx}${typeToCast ? `::${typeToCast}` : ''}`;
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
	valueToSQL(
		{ value, lastParamIdx, params, types, colIdx }: {
			value: Value;
			lastParamIdx: number;
			params: Value[] | Record<string, any>;
			types: string[];
			colIdx: number;
		},
	): string {
		if (value instanceof SQLDefault) {
			return value.generateSQL().sql;
		}

		if (Array.isArray(value)) {
			params.push(value as any);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx]);
		}

		if (
			typeof value === 'number'
			|| typeof value === 'bigint'
			|| typeof value === 'boolean'
			|| typeof value === 'string'
			|| value === null
			|| value instanceof Date
			|| typeof value === 'object'
		) {
			params.push(value);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx]);
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
	}
}

export type DbType =
	| 'int2'
	| 'int4'
	| 'int8'
	| 'numeric'
	| 'decimal'
	| 'float'
	| 'real'
	| 'double precision'
	| 'boolean'
	| 'char'
	| 'varchar'
	| 'string'
	| 'bit'
	| 'jsonb'
	| 'time'
	| 'timestamp'
	| 'date'
	| 'interval'
	| 'uuid'
	| 'inet'
	| 'geometry'
	| 'vector'
	| (string & {});

export class CockroachSQLCommonParam extends SQLCommonParam {
	INT32_MAX = 2_147_483_647;
	INT32_MIN = -2_147_483_648;

	constructor(
		value: UnsafeParamType,
		public type?: string,
	) {
		super(value);
	}

	override generateSQL(
		{ dialect, lastParamIdx }: { dialect: Dialect; lastParamIdx: number },
	) {
		// bigint case
		if (typeof this.value === 'bigint') this.type = 'int8';

		// integer case
		if (typeof this.value === 'number' && this.value % 1 === 0) {
			this.type = 'int4';
			if (this.value > this.INT32_MAX || this.value < this.INT32_MIN) {
				this.type = 'int8';
			}
		}

		const params = dialect.createEmptyParams();
		dialect.pushParams(params, this.value, lastParamIdx + 1, 'single');
		return {
			sql: dialect.escapeParam(lastParamIdx + 1, this.type),
			params,
			paramsCount: 1,
		};
	}
}

export const SQLFunctions = {
	identifier: (value: Identifier<IdentifierObject>) => {
		return new SQLIdentifier(value);
	},
	values: (value: Values, types?: DbType[]) => {
		return new SQLValues(value, types);
	},
	param: (value: any, type?: DbType) => {
		return new CockroachSQLCommonParam(value, type);
	},
	raw: (value: Raw) => {
		return new SQLRaw(value);
	},
	default: new SQLDefault(),
};
