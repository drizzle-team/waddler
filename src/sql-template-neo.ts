import type {
	DuckDBDataChunk,
	DuckDBLogicalType,
	DuckDBPreparedStatement,
	DuckDBResult,
	DuckDBType,
} from '@duckdb/node-api';
import {
	DuckDBArrayType,
	DuckDBArrayVector,
	DuckDBDateType,
	DuckDBListType,
	DuckDBListVector,
	DuckDBMapType,
	DuckDBStructType,
	DuckDBTimestampType,
	DuckDBTimeType,
	DuckDBUnionType,
	DuckDBVarCharType,
	DuckDBVector,
} from '@duckdb/node-api';
import type { DuckDBConnectionObj } from './neo.ts';
import type { RecyclingPool } from './recycling-pool.ts';
import type { SQLParamType } from './sql-template.ts';
import { SQLTemplate } from './sql-template.ts';
import type { UnsafeParamType } from './types.ts';

const MIN_INT32 = -2147483648;
const MAX_INT32 = 2147483647;

export const bindParams = (prepared: DuckDBPreparedStatement, params: UnsafeParamType[]) => {
	for (const [idx, param] of params.entries()) {
		if (param === undefined) {
			throw new Error("you can't specify undefined as parameter.");
		}
		if (typeof param === 'string') {
			prepared.bindVarchar(idx + 1, param);
			continue;
		}

		if (typeof param === 'bigint') {
			prepared.bindBigInt(idx + 1, param);
			continue;
		}

		if (typeof param === 'boolean') {
			prepared.bindBoolean(idx + 1, param);
			continue;
		}

		if (param === null) {
			prepared.bindNull(idx + 1);
			continue;
		}

		if (typeof param === 'number') {
			if (Number.isInteger(param)) {
				if (param >= MIN_INT32 && param <= MAX_INT32) {
					prepared.bindInteger(idx + 1, param);
					continue;
				}

				prepared.bindBigInt(idx + 1, BigInt(param));
				continue;
			}

			prepared.bindDouble(idx + 1, param);
			continue;
		}

		if (param instanceof Date) {
			prepared.bindTimestamp(idx + 1, { micros: BigInt(param.getTime() * 1000) });
			continue;
		}

		if (typeof param === 'object') {
			prepared.bindVarchar(idx + 1, JSON.stringify(param));
			console.log('binded array:', JSON.stringify(param));
			continue;
		}
	}
};

const TypeIdsToTransform: { [key: number]: string } = {
	12: 'TIMESTAMP',
	13: 'DATE',
	14: 'TIME',
	// INTERVAL = 15,
	// BLOB = 18,
	20: 'TIMESTAMP_S',
	21: 'TIMESTAMP_MS',
	22: 'TIMESTAMP_NS',
	// ENUM = 23,
	24: 'LIST',
	25: 'STRUCT',
	26: 'MAP',
	33: 'ARRAY',
	// UUID = 27,
	28: 'UNION',
	// BIT = 29,
	// TIME_TZ = 30,
	// TIMESTAMP_TZ = 31,
	// VARINT = 35,
	// SQLNULL = 36
};

const transformIsNeeded = (value: any, columnType: DuckDBType, columnLogicalType?: DuckDBLogicalType) => {
	if ((TypeIdsToTransform[columnType.typeId] === undefined && columnLogicalType === undefined) || value === null) {
		return false;
	}

	return true;
};

const transformValue = (value: any, columnType: DuckDBType, columnLogicalType?: DuckDBLogicalType) => {
	if (transformIsNeeded(value, columnType, columnLogicalType) === false) {
		return value;
	}

	if (columnType instanceof DuckDBDateType) {
		// value in days
		return (new Date(value * 24 * 60 * 60 * 1000));
	}

	if (columnType instanceof DuckDBTimeType) {
		// typeof value === "bigint"; time in microseconds since 00:00:00
		let microS = Number(value);
		const microSInHour = 1000 * 1000 * 60 * 60;
		const hours = Math.floor(microS / microSInHour);

		microS = microS - (hours * microSInHour);
		const microSInMinute = 1000 * 1000 * 60;
		const minutes = Math.floor(microS / microSInMinute);

		microS = microS - (minutes * microSInMinute);
		const microSInSecond = 1000 * 1000;
		const seconds = Math.floor(microS / microSInSecond);

		microS = microS - (seconds * microSInSecond);
		const milliS = Math.floor(microS / 1000);

		return (`${hours}:${minutes}:${seconds}.${milliS}`);
	}

	if (columnType instanceof DuckDBTimestampType) {
		// typeof value === "bigint"
		return (new Date(Number((value as bigint) / BigInt(1000))));
	}

	if (
		columnType instanceof DuckDBListType || columnType instanceof DuckDBArrayType
	) {
		const transformedArray = generateNDList(value);
		return transformedArray;
	}

	if (columnType instanceof DuckDBMapType) {
		const valueMap = new Map();

		for (const valueI of value as ({ key: any; value: any }[])) {
			const keyType = columnType.keyType;
			const valueType = columnType.valueType;

			valueMap.set(
				transformValue(valueI.key, keyType),
				transformValue(valueI.value, valueType),
			);
		}

		return valueMap;
	}

	if (columnType instanceof DuckDBVarCharType && columnLogicalType?.alias === 'JSON') {
		return JSON.parse(value);
	}

	if (columnType instanceof DuckDBStructType) {
		const valueStruct: { [name: string]: any } = {};
		for (const valueI of value as ({ name: string; value: any }[])) {
			const valueType = columnType.entries.find((els) => els.name === valueI.name)!.valueType;
			valueStruct[valueI.name] = transformValue(valueI.value, valueType);
		}

		return valueStruct;
	}

	if (columnType instanceof DuckDBUnionType) {
		const valueType = columnType.alternatives.find((el) => el.tag === value.tag)!.valueType;

		const transformedValue: any = transformValue(value.value, valueType);
		return transformedValue;
	}

	return value;
};

const generateNDList = (
	list: DuckDBListVector<DuckDBType> | DuckDBArrayVector<DuckDBType> | DuckDBVector<DuckDBType>,
): any[] => {
	const nDList = [];
	for (let i = 0; i < list.itemCount; i++) {
		const listItem = list.getItem(i);
		if (
			listItem instanceof DuckDBListVector || listItem instanceof DuckDBArrayVector || listItem instanceof DuckDBVector
		) {
			nDList.push(generateNDList(listItem));
			continue;
		}

		nDList.push(listItem);
	}

	return nDList;
};

export const transformResultToArrays = async (result: DuckDBResult) => {
	const data: any[][] = [];
	for (;;) {
		const chunk = await result.fetchChunk();
		if (chunk.rowCount === 0) {
			break;
		}

		const columnVectors = getColumnVectors(chunk);

		for (let rowIndex = 0; rowIndex < chunk.rowCount; rowIndex++) {
			const row: any[] = [];

			for (const [columnIndex, columnVector] of columnVectors.entries()) {
				let value = columnVector.getItem(rowIndex);
				const columnLogicalType = result.columnLogicalType(columnIndex);
				value = transformValue(value, columnVector.type, columnLogicalType);

				row.push(value);
			}
			data.push(row);
		}
		chunk.dispose();
	}

	return data;
};

export const transformResultToObjects = async (result: DuckDBResult) => {
	const data: {
		[columnName: string]: any;
	}[] = [];
	for (;;) {
		const chunk = await result.fetchChunk();
		if (chunk.rowCount === 0) {
			break;
		}

		// for (let columnIndex = 0; columnIndex < chunk.columnCount; columnIndex++) {
		// 	console.log(result.columnType(columnIndex), result.columnName(columnIndex));
		// }

		const columnVectors = getColumnVectors(chunk);

		for (let rowIndex = 0; rowIndex < chunk.rowCount; rowIndex++) {
			const row = transformResultRowToObject(result, columnVectors, rowIndex);
			data.push(row);
		}
		chunk.dispose();
	}

	return data;
};

const transformResultRowToObject = (result: DuckDBResult, columnVectors: DuckDBVector<any>[], rowIndex: number) => {
	const row: { [key: string]: any } = {};

	for (const [columnIndex, columnVector] of columnVectors.entries()) {
		let value = columnVector.getItem(rowIndex);
		console.log('value:', value);
		const columnLogicalType = result.columnLogicalType(columnIndex);
		value = transformValue(value, columnVector.type, columnLogicalType);
		const colName = result.columnName(columnIndex);

		row[colName] = value;
	}

	return row;
};

const getColumnVectors = (chunk: DuckDBDataChunk) => {
	const columnVectors: DuckDBVector<any>[] = [];

	for (let columnIndex = 0; columnIndex < chunk.columnCount; columnIndex++) {
		const columnVector = chunk.getColumn(columnIndex);
		columnVectors.push(columnVector);
	}

	return columnVectors;
};

export class NeoSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected readonly strings: readonly string[],
		protected readonly params: SQLParamType[],
		protected readonly pool: RecyclingPool<DuckDBConnectionObj>,
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

		const connObj = await this.pool.acquire();

		const prepared = await connObj.connection.prepare(query);
		bindParams(prepared, params);

		const duckDbResult = await prepared.run();
		const result = await transformResultToObjects(duckDbResult) as T[];

		await this.pool.release(connObj);

		return result;
	}

	async *stream() {
		const { query, params } = this.toSQL();

		const connObj = await this.pool.acquire();

		const prepared = await connObj.connection.prepare(query);
		bindParams(prepared, params);

		const duckDbResult = await prepared.run();
		for (;;) {
			const chunk = await duckDbResult.fetchChunk();
			if (chunk.rowCount === 0) {
				break;
			}

			const columnVectors: DuckDBVector<any>[] = getColumnVectors(chunk);

			for (let rowIndex = 0; rowIndex < chunk.rowCount; rowIndex++) {
				const row = transformResultRowToObject(duckDbResult, columnVectors, rowIndex) as T;
				yield row;
			}

			chunk.dispose();
		}

		await this.pool.release(connObj);
	}
}
