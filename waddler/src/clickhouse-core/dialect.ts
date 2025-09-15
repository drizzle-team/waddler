import type { ClickHouseSQLTemplate } from '../clickhouse/session.ts';
import {
	Dialect,
	SQLCommonParam,
	SQLDefault,
	SQLIdentifier,
	SQLQuery,
	SQLRaw,
	SQLValues,
} from '../sql-template-params.ts';
import { type SQL, SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Value, Values } from '../types.ts';
import { getArrayDepth, makeClickHouseArray } from './utils.ts';

export class ClickHouseDialect extends Dialect {
	escapeParam(lastParamIdx: number, typeToCast?: string): string {
		return `{param${lastParamIdx}:${typeToCast || 'String'}}`;
	}

	override createEmptyParams(): Record<string, any> {
		return {};
	}

	override pushParams(
		params: Record<string, any>,
		param: any | Record<string, any>,
		lastParamIdx: number,
		mode: 'bulk' | 'single' = 'bulk',
	) {
		if (mode === 'bulk') Object.assign(params, param);
		else params[`param${lastParamIdx}`] = param;
	}

	escapeIdentifier(identifier: string): string {
		return `\`${identifier}\``;
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

	valueToSQL(
		{ value, lastParamIdx, params, types, colIdx, paramsCount }: {
			value: Value;
			lastParamIdx: number;
			params: Record<string, Value>;
			types: DbType[];
			colIdx: number;
			paramsCount: number;
		},
	): { sql: string; addParamsCount?: number } {
		// TODO: add mapValueToType

		if (value instanceof SQLDefault) {
			return { sql: value.generateSQL().sql };
		}

		if (value instanceof SQLRaw) {
			return { sql: value.generateSQL().sql };
		}

		if (typeof value === 'bigint') {
			this.pushParams(params, `${value}`, lastParamIdx + paramsCount + 1, 'single');
			return { sql: this.escapeParam(lastParamIdx + paramsCount + 1, types[colIdx]), addParamsCount: 1 };
		}

		if (Array.isArray(value)) {
			const { mappedArray: mappedValue, baseTypeToCast } = makeClickHouseArray(value, types[colIdx]);
			let arrayTypeToCast: string | undefined;
			if (baseTypeToCast !== undefined) {
				const arrayDepth = getArrayDepth(value);
				arrayTypeToCast = baseTypeToCast;
				for (let i = 0; i < arrayDepth; i++) arrayTypeToCast = `Array(${arrayTypeToCast})`;
			}

			this.pushParams(params, mappedValue, lastParamIdx + paramsCount + 1, 'single');
			return {
				sql: this.escapeParam(lastParamIdx + paramsCount + 1, types[colIdx] ?? arrayTypeToCast),
				addParamsCount: 1,
			};
		}

		if (
			typeof value === 'number'
			|| typeof value === 'boolean'
			|| typeof value === 'string'
			|| value === null
			|| value instanceof Date
		) {
			this.pushParams(params, value, lastParamIdx + paramsCount + 1, 'single');
			return { sql: this.escapeParam(lastParamIdx + paramsCount + 1, types[colIdx]), addParamsCount: 1 };
		}

		if (value instanceof Map || (typeof value === 'object' && value.constructor?.name === 'TupleParam')) {
			// Map, Tuple type
			this.pushParams(params, value, lastParamIdx + paramsCount + 1, 'single');
			return { sql: this.escapeParam(lastParamIdx + paramsCount + 1, types[colIdx]), addParamsCount: 1 };
		}

		if (typeof value === 'object') {
			// should be JSON type
			this.pushParams(params, JSON.stringify(value), lastParamIdx + paramsCount + 1, 'single');
			return { sql: this.escapeParam(lastParamIdx + paramsCount + 1, types[colIdx] ?? 'JSON'), addParamsCount: 1 };
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
	}
}

export class ClickHouseSQLCommonParam extends SQLCommonParam {
	INT32_MAX = 2_147_483_647;
	INT32_MIN = -2_147_483_648;

	constructor(
		value: UnsafeParamType,
		public type: string = 'String',
	) {
		super(value);
	}

	override generateSQL(
		{ dialect, lastParamIdx }: { dialect: Dialect; lastParamIdx: number },
	) {
		// bigint case
		if (typeof this.value === 'bigint') this.type = 'Int64';

		// integer case
		if (typeof this.value === 'number' && this.value % 1 === 0) {
			this.type = 'Int32';
			if (this.value > this.INT32_MAX || this.value < this.INT32_MIN) {
				this.type = 'Int64';
			}
		}

		// array case
		if (Array.isArray(this.value)) {
			const nodeType = typeof this.value[0];
			if (nodeType === 'string') this.type = 'Array(String)';
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

export class UnsafePromise<
	T,
	DriverT extends ClickHouseSQLTemplate<T>,
> {
	constructor(public driver: DriverT) {}

	command(): Omit<UnsafePromise<T, DriverT>, 'command' | 'query'> {
		this.driver.command();
		return this;
	}

	query(): Omit<UnsafePromise<T, DriverT>, 'command' | 'query'> {
		this.driver.query();
		return this;
	}

	stream() {
		return this.driver.stream();
	}

	// Allow it to be awaited (like a Promise)
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?:
			| ((value: T[]) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined,
	): Promise<TResult1 | TResult2> {
		// Here you could handle the query execution logic (replace with your own)
		const result = this.driver.execute();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}
}

export interface ClickHouseCoreSQL extends Pick<SQL, 'identifier' | 'raw' | 'default'> {
	/**
	 * @param values - A two-dimensional array of rows to insert; each inner array represents one row of values.
	 * @param types - (Optional) An array of ClickHouse data types (e.g. ['Int32', 'String']) used to cast each column value.
	 *
	 * If omitted, or if there are fewer types than columns, any missing types default to 'String'.
	 *
	 * For full list of types, see https://clickhouse.com/docs/sql-reference/data-types
	 *
	 * @example
	 * ```ts
	 * const rows = [
	 *   [1, 'qwerty1'],
	 *   [2, 'qwerty2']
	 * ];
	 * const types = ['Int32', 'String'];
	 *
	 * sql`INSERT INTO <tableIdentifier> VALUES ${sql.values(rows, types)};`
	 * ```
	 *
	 * This generates and executes:
	 *
	 * ```sql
	 * INSERT INTO <tableIdentifier>
	 * VALUES ({param1:Int32}, {param2:String}), ({param3:Int32}, {param4:String});
	 * ```
	 *
	 * with these query parameters:
	 * ```ts
	 * {
	 *   param1: 1,
	 *   param2: 'qwerty1',
	 *   param3: 2,
	 *   param4: 'qwerty2'
	 * }
	 * ```
	 */
	values(value: Values, types?: DbType[]): SQLValues;
	param(value: any, type: DbType): ClickHouseSQLCommonParam;
}

export type DbType =
	| 'Int8'
	| 'Int16'
	| 'Int32'
	| 'Int64'
	| 'Int128'
	| 'Int256'
	| 'UInt8'
	| 'UInt16'
	| 'UInt32'
	| 'UInt64'
	| 'UInt128'
	| 'UInt256'
	| 'Float32'
	| 'Float64'
	| 'BFloat16'
	| 'Decimal'
	| 'Decimal32'
	| 'Decimal64'
	| 'Decimal128'
	| 'Decimal256'
	| 'String'
	| 'FixedString'
	| 'Enum'
	| 'UUID'
	| 'IPv4'
	| 'IPv6'
	| 'Date'
	| 'Date32'
	| 'Time'
	| 'Time64'
	| 'DateTime'
	| 'DateTime64'
	| 'Bool'
	| 'JSON'
	| 'Tuple'
	| 'Map'
	| 'Variant'
	| 'LowCardinality'
	| 'Nullable'
	| 'Point'
	| 'Ring'
	| 'LineString'
	| 'MultiLineString'
	| 'Polygon'
	| 'MultiPolygon'
	| (string & {});

export const SQLFunctions = {
	identifier: (value: Identifier<IdentifierObject>) => {
		return new SQLIdentifier(value);
	},
	values: (value: Values, types?: DbType[]) => {
		return new SQLValues(value, types);
	},
	param: (value: any, type?: DbType) => {
		return new ClickHouseSQLCommonParam(value, type);
	},
	raw: (value: Raw) => {
		return new SQLRaw(value);
	},
	default: new SQLDefault(),
};

export interface ClickHouseSQLQuery extends ClickHouseCoreSQL {
	(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery<ClickHouseDialect>;
}

const sql = ((strings: TemplateStringsArray, ...params: SQLParamType[]): SQLQuery => {
	const sqlWrapper = new SQLWrapper();
	sqlWrapper.setOverrides({ SQLCommonParam: ClickHouseSQLCommonParam });
	sqlWrapper.with({ templateParams: { strings, params } });
	const dialect = new ClickHouseDialect();

	return new SQLQuery(sqlWrapper, dialect);
}) as ClickHouseSQLQuery;

Object.assign(sql, SQLFunctions);

export { sql };
