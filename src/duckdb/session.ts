import duckdb from 'duckdb';
import { SQLParamType } from '~/types.ts';
import { DuckdbDialect } from '../duckdb-core/dialect.ts';
import type { RecyclingPool } from '../recycling-pool.ts';
import { SQLTemplate } from '../sql-template.ts';
import { stringifyArray } from '../utils.ts';
import { methodPromisify } from './utils.ts';

const statementAllAsync = methodPromisify<duckdb.Statement, duckdb.TableData>(
	duckdb.Statement.prototype.all,
);

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
		}
		data.push(row);
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
		query: string,
		params: SQLParamType[],
		protected readonly pool: RecyclingPool<duckdb.Database>,
	) {
		super(query, params);
	}

	async execute() {
		// Implement your actual DB execution logic here
		// This could be a fetch or another async operation
		// gets connection from pool, runs query, release connection
		const { query, params } = this.toSQL();
		let result;

		prepareParams(params);
		const db = await this.pool.acquire();

		// wrapping duckdb driver error in new js error to add stack trace to it
		try {
			const statement = db.prepare(query);

			const duckdbResult = await statementAllAsync(statement, ...params);

			const columnInfo = statement.columns();
			result = transformResult(duckdbResult, columnInfo) as T[];
		} catch (error) {
			await this.pool.release(db);
			const newError = new Error((error as Error).message);
			throw newError;
		}

		await this.pool.release(db);

		return result;
	}

	async *stream() {
		let row: T;
		const { query, params } = this.toSQL();

		prepareParams(params);

		const db = await this.pool.acquire();

		// wrapping duckdb driver error in new js error to add stack trace to it
		try {
			const stream = db.stream(query, ...params);

			const asyncIterator = stream[Symbol.asyncIterator]();

			let iterResult = await asyncIterator.next();
			while (!iterResult.done) {
				row = iterResult.value as T;
				yield row;

				iterResult = await asyncIterator.next();
			}
		} catch (error) {
			await this.pool.release(db);
			const newError = new Error((error as Error).message);
			throw newError;
		}

		await this.pool.release(db);
	}
}
