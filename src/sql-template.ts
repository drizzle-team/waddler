import duckdb from 'duckdb';
import type { RecyclingPool } from './recycling-pool.ts';
import { methodPromisify } from './utils.ts';

const dbAllAsync = methodPromisify<duckdb.Database, duckdb.TableData>(
	duckdb.Database.prototype.all,
);

export type SQLParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| SQLIndetifier
	| SQLValues
	| SQLRaw
	| SQLDefault
	| null;

export class SQLTemplate<T> {
	constructor(
		private readonly strings: readonly string[],
		private readonly params: SQLParamType[],
		private readonly pool: RecyclingPool<duckdb.Database>,
	) {
		this.strings = strings;
		this.params = params;
		this.pool = pool;
	}

	// Method to extract raw SQL
	toSQL() {
		if (this.params.length === 0) {
			return { query: this.strings[0], params: this.params };
		}

		const filteredParams = [];
		let query = '', idxShift = 0;
		for (const [idx, stringI] of this.strings.entries()) {
			if (idx === this.strings.length - 1) {
				query += stringI;
				continue;
			}

			let typedPlaceholder: string;
			if (
				this.params[idx] instanceof SQLIndetifier
				|| this.params[idx] instanceof SQLValues
				|| this.params[idx] instanceof SQLRaw
				|| this.params[idx] instanceof SQLDefault
			) {
				typedPlaceholder = this.params[idx].generateSQL();
				idxShift += 1;
				query += stringI + typedPlaceholder;
				continue;
			}

			// need to use toString cause duckdb can't handle node js BigInt type as parameter.
			if (typeof this.params[idx] === 'bigint') {
				typedPlaceholder = `${this.params[idx]}`;
				idxShift += 1;
				query += stringI + typedPlaceholder;
				continue;
			}

			if (
				typeof this.params[idx] === 'object'
				&& !(this.params[idx] instanceof Date)
				&& this.params[idx] !== null
			) {
				throw new Error("you can't specify array or object as parameter");
			}

			if (this.params[idx] === undefined) {
				throw new Error("you can't specify undefined as parameter");
			}

			if (typeof this.params[idx] === 'symbol') {
				throw new Error("you can't specify symbol as parameter");
			}

			if (typeof this.params[idx] === 'function') {
				throw new Error("you can't specify function as parameter");
			}

			typedPlaceholder = `$${idx + 1 - idxShift}`;
			query += stringI + typedPlaceholder;
			filteredParams.push(this.params[idx]);
		}

		return {
			query,
			params: filteredParams,
		};
	}

	// Allow it to be awaited (like a Promise)
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null | undefined,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
	): Promise<TResult1 | TResult2> {
		// Here you could handle the query execution logic (replace with your own)
		const result = this.executeQuery();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}

	private async executeQuery() {
		// Implement your actual DB execution logic here
		// This could be a fetch or another async operation
		// gets connection from pool, runs query, release connection
		const { query, params } = this.toSQL();
		const db = await this.pool.acquire();

		const result = await dbAllAsync(db, query, ...params) as T[];

		await this.pool.release(db);

		return result;
	}

	async *stream() {
		let row: T;
		const { query, params } = this.toSQL();

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

export type Identifier = string | string[] | { schema?: string; table?: string; column?: string; as?: string } | {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
}[];

export class SQLIndetifier {
	constructor(private readonly value: Identifier) {}

	// TODO: @AlexBlokh do error's text
	static checkObject(object: { schema?: string; table?: string; column?: string; as?: string }) {
		if (Object.values(object).includes(undefined!)) {
			throw new Error(`you can't specify undefined parameters. maybe you want to omit it?`);
		}

		if (Object.keys(object).length === 0) {
			throw new Error(`you need to specify at least one parameter.`);
		}

		if (object.schema !== undefined && object.table === undefined && object.column !== undefined) {
			throw new Error(`you can't specify only "schema" and "column" properties, you need also specify "table".`);
		}

		if (Object.keys(object).length === 1 && object.as !== undefined) {
			throw new Error(`you can't specify only "as" property.`);
		}

		if (object.as !== undefined && object.column === undefined && object.table === undefined) {
			throw new Error(`you have to specify "column" or "table" property along with "as".`);
		}

		if (
			!['string', 'undefined'].includes(typeof object.schema)
			|| !['string', 'undefined'].includes(typeof object.table)
			|| !['string', 'undefined'].includes(typeof object.column)
			|| !['string', 'undefined'].includes(typeof object.as)
		) {
			throw new Error("object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.");
		}
	}

	static objectToSQL(object: { schema?: string; table?: string; column?: string; as?: string }) {
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
				throw new Error(`you can't specify empty array as parameter for sql.identifier.`);
			}

			if (this.value.every((val) => typeof val === 'string')) {
				return `"${this.value.join('", "')}"`;
			}

			if (this.value.every((val) => typeof val === 'object' && !Array.isArray(val) && val !== null)) {
				return `${this.value.map((element) => SQLIndetifier.objectToSQL(element)).join(', ')}`;
			}

			let areThereAnyArrays = false;
			for (const val of this.value) {
				if (Array.isArray(val)) {
					areThereAnyArrays = true;
					break;
				}
			}
			if (areThereAnyArrays) {
				throw new Error(`you can't specify array of arrays as parameter for sql.identifier.`);
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
			throw new Error(`you can't specify null as parameter for sql.identifier.`);
		}

		throw new Error(`you can't specify ${typeof this.value} as parameter for sql.identifier.`);
	}
}

export type Values = (string | number | bigint | boolean | Date | SQLDefault | null)[][];
export class SQLValues {
	constructor(private readonly value: Values) {}
	// object to throw an error
	// if Date not to throw an error

	static arrayToSQL(array: Values[number]) {
		if (Array.isArray(array)) {
			if (array.length === 0) {
				throw new Error(`array of values can't be empty.`);
			}

			return `(${
				array
					.map((val) => {
						if (typeof val === 'number' || typeof val === 'bigint' || typeof val === 'boolean' || val === null) {
							return `${val}`;
						}

						if (val instanceof SQLDefault) {
							return val.generateSQL();
						}

						if (val instanceof Date) {
							return `'${val.toISOString()}'`;
						}

						if (typeof val === 'string') {
							return `'${val}'`;
						}

						if (typeof val === 'object') {
							// array or object case
							throw new Error(
								"value can't be array or object. you can't specify [ [ [...], ...], ...] or [ [ {...}, ...], ...] as parameter for sql.values.",
							);
						}

						if (val === undefined) {
							throw new Error("value can't be undefined, maybe you mean sql.default?");
						}

						throw new Error(`you can't specify ${typeof val} as value.`);
					}).join(', ')
			})`;
		}

		if (array === null) throw new Error(`you can't specify array of null as parameter for sql.values.`);
		throw new Error(`you can't specify array of ${typeof array} as parameter for sql.values.`);
	}

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
}

export type Raw = string | number | boolean | bigint;
export class SQLRaw {
	constructor(private readonly value: Raw) {}

	generateSQL() {
		if (
			typeof this.value === 'number' || typeof this.value === 'bigint' || typeof this.value === 'string'
			|| typeof this.value === 'boolean'
		) {
			return `${this.value}`;
		}

		if (typeof this.value === 'object') {
			throw new Error("you can't specify array, object or null as parameter for sql.raw.");
		}

		if (this.value === undefined) {
			throw new Error("you can't specify undefined as parameter for sql.raw, maybe you mean using sql.default?");
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
