import { TupleParam } from '@clickhouse/client';
import type { ClickHouseSQLTemplate } from '../clickhouse/session.ts';
import { Dialect, SQLDefault, SQLRaw } from '../sql-template-params.ts';
import type { IdentifierObject, Value } from '../types.ts';
import { getArrayDepth, makeClickHouseArray } from './utils.ts';

export class ClickHouseDialect extends Dialect {
	escapeParam(lastParamIdx: number, typeToCast?: string): string {
		return `{val${lastParamIdx}:${typeToCast || 'String'}}`;
	}

	override formParam(param: any, lastParamIdx: number) {
		return [`val${lastParamIdx}`, param];
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
		{ value, lastParamIdx, params, types, colIdx }: {
			value: Value;
			lastParamIdx: number;
			params: Value[];
			types: DbType[];
			colIdx: number;
		},
	): string {
		// TODO: add mapValueToType

		if (value instanceof SQLDefault) {
			return value.generateSQL().sql;
		}

		if (value instanceof SQLRaw) {
			return value.generateSQL().sql;
		}

		if (typeof value === 'bigint') {
			params.push([`val${lastParamIdx + params.length + 1}`, `${value}`] as any);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx]);
		}

		if (Array.isArray(value)) {
			const { mappedArray: mappedValue, baseTypeToCast } = makeClickHouseArray(value, types[colIdx]);
			let arrayTypeToCast: string | undefined;
			if (baseTypeToCast !== undefined) {
				const arrayDepth = getArrayDepth(value);
				arrayTypeToCast = baseTypeToCast;
				for (let i = 0; i < arrayDepth; i++) arrayTypeToCast = `Array(${arrayTypeToCast})`;
			}

			params.push([`val${lastParamIdx + params.length + 1}`, mappedValue] as any);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx] ?? arrayTypeToCast);
		}

		if (
			typeof value === 'number'
			|| typeof value === 'boolean'
			|| typeof value === 'string'
			|| value === null
			|| value instanceof Date
		) {
			params.push([`val${lastParamIdx + params.length + 1}`, value] as any);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx]);
		}

		if (value instanceof Map || value instanceof TupleParam) {
			// Map, Tuple type
			params.push([`val${lastParamIdx + params.length + 1}`, value] as any);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx]);
		}

		if (typeof value === 'object') {
			// should be JSON type
			params.push([`val${lastParamIdx + params.length + 1}`, JSON.stringify(value)] as any);
			return this.escapeParam(lastParamIdx + params.length, types[colIdx] ?? 'JSON');
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		throw new Error(`you can't specify ${typeof value} as value.`);
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
