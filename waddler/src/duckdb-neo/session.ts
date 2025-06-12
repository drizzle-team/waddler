import type { DuckDBVector } from '@duckdb/node-api';
import { WaddlerQueryError } from '../errors/index.ts';
import type { RecyclingPool } from '../recycling-pool.ts';
import type { Dialect } from '../sql-template-params.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { SQLWrapper } from '../sql.ts';
import { getColumnVectors, transformResultRowToObject, transformResultToObjects } from './result-transformers.ts';
import type { DuckDBConnectionObj } from './types.ts';
import { bindParams } from './utils.ts';

export class DuckdbNeoSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		sql: SQLWrapper,
		protected readonly pool: RecyclingPool<DuckDBConnectionObj>,
		dialect: Dialect,
	) {
		super(sql, dialect);
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		let result;

		const connObj = await this.pool.acquire();

		// wrapping duckdb driver error in new js error to add stack trace to it
		try {
			const prepared = await connObj.connection.prepare(query);
			bindParams(prepared, params);

			const duckDbResult = await prepared.run().finally();
			result = await transformResultToObjects(duckDbResult) as T[];
		} catch (error) {
			// TODO: this error handler does not work right, fix it
			await this.pool.release(connObj);
			throw new WaddlerQueryError(query, params, error as Error);
		}

		await this.pool.release(connObj);

		return result;
	}

	async *stream() {
		const { query, params } = this.sql.getQuery();

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
			throw new WaddlerQueryError(query, params, error as Error);
		}

		await this.pool.release(connObj);
	}
}
