import duckdb from 'duckdb';
import type { RecyclingPool } from './recycling-pool.ts';
import type { DuckDBConnectionObj, JSONArray, JSONObject, ParamType } from './types.ts';
import { methodPromisify, stringifyArray } from './utils.ts';

const statementAllAsync = methodPromisify<duckdb.Statement, duckdb.TableData>(
	duckdb.Statement.prototype.all,
);

export type SQLParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONArray
	| JSONObject
	| SQLIndetifier
	| SQLValues
	| SQLRaw
	| SQLDefault;

export abstract class SQLTemplate<T> {
	protected abstract strings: readonly string[];
	protected abstract params: SQLParamType[];
	protected abstract readonly pool: RecyclingPool<duckdb.Database> | RecyclingPool<DuckDBConnectionObj>;

	append(value: SQLTemplate<any>) {
		this.strings = [
			...this.strings.slice(0, -1),
			`${this.strings.at(-1)}${value.strings.at(0)}`,
			...value.strings.slice(1),
		];
		this.params = [...this.params, ...value.params];
	}

	// Method to extract raw SQL
	toSQL() {
		if (this.params.length === 0) {
			return { query: this.strings[0] ?? '', params: [] };
		}

		const filteredParams: ParamType[] = [];
		let query = '',
			idxShift = 0,
			param: any;
		for (const [idx, stringI] of this.strings.entries()) {
			if (idx === this.strings.length - 1) {
				query += stringI;
				continue;
			}

			param = this.params[idx];
			let typedPlaceholder: string;
			if (
				param instanceof SQLIndetifier
				|| param instanceof SQLValues
				|| param instanceof SQLRaw
				|| param instanceof SQLDefault
			) {
				typedPlaceholder = param.generateSQL();
				idxShift += 1;
				query += stringI + typedPlaceholder;
				continue;
			}

			if (param === undefined) {
				throw new Error("you can't specify undefined as parameter");
			}

			if (typeof param === 'symbol') {
				throw new Error("you can't specify symbol as parameter");
			}

			if (typeof param === 'function') {
				throw new Error("you can't specify function as parameter");
			}

			typedPlaceholder = `$${idx + 1 - idxShift}`;
			query += stringI + typedPlaceholder;
			filteredParams.push(param);
		}

		return {
			query,
			params: filteredParams,
		};
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
		const result = this.executeQuery();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}

	protected abstract executeQuery(): Promise<T[]>;

	abstract stream(): AsyncGenerator<Awaited<T>, void, unknown>;

	async *chunked(chunkSize: number = 1) {
		let rows: T[] = [];
		let row: T;
		const asyncIterator = this.stream();
		let iterResult = await asyncIterator.next();

		while (!iterResult.done) {
			row = iterResult.value as T;
			rows.push(row);

			if (rows.length % chunkSize === 0) {
				yield rows;
				rows = [];
			}

			iterResult = await asyncIterator.next();
		}

		if (rows.length !== 0) {
			yield rows;
		}
	}
}

const prepareParams = (params: any[]) => {
	for (const [idx, param] of params.entries()) {
		if (typeof param === 'bigint') {
			// need to use toString because node duckdb driver can't handle node js BigInt type as parameter.
			params[idx] = `${param}`;
			continue;
		}

		if (typeof param === 'object' && !(param instanceof Date)) {
			if (Array.isArray(param)) {
				params[idx] = stringifyArray(param);
				continue;
			}

			params[idx] = JSON.stringify(param);
			continue;
		}
	}
};

const transformResult = (
	result: duckdb.TableData,
	columnInfo: duckdb.ColumnInfo[],
) => {
	const columnInfoObj: { [key: string]: duckdb.ColumnInfo } = {};
	for (const colInfoI of columnInfo) {
		columnInfoObj[colInfoI.name] = colInfoI;
	}

	const data: {
		[columnName: string]: any;
	}[] = [];

	for (const row of result) {
		for (const colName of Object.keys(row)) {
			const columnType = columnInfoObj[colName]?.type;
			const value = row[colName];

			const transformedValue = transformResultValue(value, columnType);
			row[colName] = transformedValue;

			data.push(row);
		}
	}

	return data;
};

const transformResultValue = (value: any, columnType: duckdb.TypeInfo | undefined) => {
	if (value === null) return value;

	if (typeof value === 'string' && columnType?.alias === 'JSON') {
		return JSON.parse(value);
	}

	if (columnType?.id === 'ARRAY') {
		if (
			columnType?.sql_type.includes('JSON')
			|| columnType?.sql_type.includes('INTEGER')
			|| columnType?.sql_type.includes('SMALLINT')
			|| columnType?.sql_type.includes('TINYINT')
			|| columnType?.sql_type.includes('DOUBLE')
			|| columnType?.sql_type.includes('FLOAT')
			|| columnType?.sql_type.includes('DECIMAL')
			|| columnType?.sql_type.includes('BOOLEAN')
		) {
			return JSON.parse(value);
		}

		return value;
	}

	if (columnType?.id === 'LIST') {
		return transformNDList(value, columnType);
	}

	return value;
};

const transformNDList = (list: any[] | any, listType: duckdb.ListTypeInfo | duckdb.TypeInfo): any[] => {
	if (!Array.isArray(list)) {
		return transformResultValue(list, listType);
	}

	const nDList = [];
	for (const el of list) {
		nDList.push(transformNDList(el, (listType as duckdb.ListTypeInfo).child));
	}

	return nDList;
};

export class DefaultSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected strings: readonly string[],
		protected params: SQLParamType[],
		protected readonly pool: RecyclingPool<duckdb.Database>,
	) {
		super();
		this.strings = strings;
		this.params = params;
		this.pool = pool;
	}

	protected async executeQuery() {
		// Implement your actual DB execution logic here
		// This could be a fetch or another async operation
		// gets connection from pool, runs query, release connection
		const { query, params } = this.toSQL();

		prepareParams(params);
		const db = await this.pool.acquire();

		const statement = db.prepare(query);

		const duckdbResult = await statementAllAsync(statement, ...params);

		await this.pool.release(db);
		const columnInfo = statement.columns();
		const result = transformResult(duckdbResult, columnInfo) as T[];

		return result;
	}

	async *stream() {
		let row: T;
		const { query, params } = this.toSQL();

		prepareParams(params);

		const db = await this.pool.acquire();

		const stream = db.stream(query, ...params);

		const asyncIterator = stream[Symbol.asyncIterator]();

		let iterResult = await asyncIterator.next();
		while (!iterResult.done) {
			row = iterResult.value as T;
			yield row;

			iterResult = await asyncIterator.next();
		}

		await this.pool.release(db);
	}
}

export type Identifier =
	| string
	| string[]
	| { schema?: string; table?: string; column?: string; as?: string }
	| {
		schema?: string;
		table?: string;
		column?: string;
		as?: string;
	}[];

export class SQLIndetifier {
	constructor(private readonly value: Identifier) {}

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
		SQLIndetifier.checkObject(object);

		const schema = object.schema === undefined ? '' : `"${object.schema}".`;
		const table = object.table === undefined ? '' : `"${object.table}"`;
		const column = object.column === undefined ? '' : `."${object.column}"`;
		const as = object.as === undefined ? '' : ` as "${object.as}"`;

		return `${schema}${table}${column}${as}`.replace(/^\.|\.$/g, '');
	}

	generateSQL() {
		if (typeof this.value === 'string') {
			return `"${this.value}"`;
		}

		if (Array.isArray(this.value)) {
			if (this.value.length === 0) {
				throw new Error(
					`you can't specify empty array as parameter for sql.identifier.`,
				);
			}

			if (this.value.every((val) => typeof val === 'string')) {
				return `"${this.value.join('", "')}"`;
			}

			if (
				this.value.every(
					(val) => typeof val === 'object' && !Array.isArray(val) && val !== null,
				)
			) {
				return `${
					this.value
						.map((element) => SQLIndetifier.objectToSQL(element))
						.join(', ')
				}`;
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
			return SQLIndetifier.objectToSQL(this.value);
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

export type Value = string | number | bigint | boolean | Date | SQLDefault | null | Value[];
export type Values = Value[][];
export class SQLValues {
	constructor(private readonly value: Values) {}

	generateSQL() {
		if (!Array.isArray(this.value)) {
			if (this.value === null) throw new Error(`you can't specify null as parameter for sql.values.`);
			throw new Error(`you can't specify ${typeof this.value} as parameter for sql.values.`);
		}

		if (this.value.length === 0) {
			throw new Error(`you can't specify empty array as parameter for sql.values.`);
		}

		return this.value
			.map((val) => SQLValues.arrayToSQL(val))
			.join(', ');
	}

	private static arrayToSQL(array: Value[]) {
		if (Array.isArray(array)) {
			if (array.length === 0) {
				throw new Error(`array of values can't be empty.`);
			}

			return `(${array.map((val) => SQLValues.valueToSQL(val)).join(', ')})`;
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

		if (value instanceof SQLDefault) {
			return value.generateSQL();
		}

		if (value instanceof Date) {
			return `'${value.toISOString()}'`;
		}

		if (typeof value === 'string') {
			return `'${value}'`;
		}

		if (Array.isArray(value)) {
			return `[${value.map((arrayValue) => SQLValues.valueToSQL(arrayValue))}]`;
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

export type Raw = string | number | boolean | bigint;
export class SQLRaw {
	constructor(private readonly value: Raw) {}

	generateSQL() {
		if (
			typeof this.value === 'number'
			|| typeof this.value === 'bigint'
			|| typeof this.value === 'string'
			|| typeof this.value === 'boolean'
		) {
			return `${this.value}`;
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

export class SQLDefault {
	generateSQL() {
		return 'default';
	}
}
