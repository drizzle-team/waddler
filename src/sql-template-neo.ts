import type { DuckDBVector } from '@duckdb/node-api';
import {
	getColumnVectors,
	transformResultRowToObject,
	transformResultToObjects,
} from './duckdb-neo/result-transformers.ts';
import { bindParams } from './duckdb-neo/utils.ts';
import type { DuckDBConnectionObj } from './types.ts';
import type { RecyclingPool } from './recycling-pool.ts';
import type { SQLParamType } from './sql-template.ts';
import { SQLTemplate } from './sql-template.ts';

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
		}

		await this.pool.release(connObj);
	}
}
