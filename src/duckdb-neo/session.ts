import type { DuckDBVector } from '@duckdb/node-api';
import { SQLParamType } from '~/types.ts';
import type { RecyclingPool } from '../recycling-pool.ts';
import { SQLTemplate } from '../sql-template.ts';
import { getColumnVectors, transformResultRowToObject, transformResultToObjects } from './result-transformers.ts';
import { DuckDBConnectionObj } from './types.ts';
import { bindParams } from './utils.ts';

export class DuckdbNeoSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		query: string,
		params: SQLParamType[],
		protected readonly pool: RecyclingPool<DuckDBConnectionObj>,
	) {
		super(query, params);
	}

	async execute() {
		// Implement your actual DB execution logic here
		// This could be a fetch or another async operation
		// gets connection from pool, runs query, release connection
		const { query, params } = this.toSQL();
		let result;

		const connObj = await this.pool.acquire();

		// wrapping duckdb driver error in new js error to add stack trace to it
		try {
			const prepared = await connObj.connection.prepare(query);
			bindParams(prepared, params);

			const duckDbResult = await prepared.run().finally();
			result = await transformResultToObjects(duckDbResult) as T[];
		} catch (error) {
			await this.pool.release(connObj);
			const newError = new Error((error as Error).message);
			throw newError;
		}

		await this.pool.release(connObj);

		return result;
	}

	async *stream() {
		const { query, params } = this.toSQL();

		const connObj = await this.pool.acquire();

		// wrapping duckdb driver error in new js error to add stack trace to it
		try {
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
			}
		} catch (error) {
			await this.pool.release(connObj);
			const newError = new Error((error as Error).message);
			throw newError;
		}

		await this.pool.release(connObj);
	}
}
