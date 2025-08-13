import type { DuckDBDataChunk, DuckDBResult, DuckDBVector } from '@duckdb/node-api';
import { transformValue } from './utils.ts';

export const transformResultToArrays = async (result: DuckDBResult) => {
	const data: any[][] = [];
	const chunks = await result.fetchAllChunks();
	for (const chunk of chunks) {
		const columnVectors = getColumnVectors(chunk);

		for (let rowIndex = 0; rowIndex < chunk.rowCount; rowIndex++) {
			const row: any[] = [];

			for (const [columnIndex, columnVector] of columnVectors.entries()) {
				let value = columnVector.getItem(rowIndex);
				const columnType = result.columnType(columnIndex);
				value = transformValue(value, columnType);

				row.push(value);
			}
			data.push(row);
		}
	}

	return data;
};

export const transformResultToObjects = async (result: DuckDBResult) => {
	const data: {
		[columnName: string]: any;
	}[] = [];

	const chunks = await result.fetchAllChunks();
	for (const chunk of chunks) {
		const columnVectors = getColumnVectors(chunk);

		for (let rowIndex = 0; rowIndex < chunk.rowCount; rowIndex++) {
			const row = transformResultRowToObject(result, columnVectors, rowIndex);
			data.push(row);
		}
	}

	return data;
};

export const transformResultRowToObject = (
	result: DuckDBResult,
	columnVectors: DuckDBVector<any>[],
	rowIndex: number,
) => {
	const row: { [key: string]: any } = {};

	for (const [columnIndex, columnVector] of columnVectors.entries()) {
		let value = columnVector.getItem(rowIndex);
		const columnType = result.columnType(columnIndex);
		value = transformValue(value, columnType);
		const colName = result.columnName(columnIndex);

		row[colName] = value;
	}

	return row;
};

export const getColumnVectors = (chunk: DuckDBDataChunk) => {
	const columnVectors: DuckDBVector<any>[] = [];

	for (let columnIndex = 0; columnIndex < chunk.columnCount; columnIndex++) {
		const columnVector = chunk.getColumnVector(columnIndex);
		columnVectors.push(columnVector);
	}

	return columnVectors;
};
