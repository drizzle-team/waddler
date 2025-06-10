import type { Connection as CallbackConnection } from 'mysql2';
import type { Connection, Pool, PoolConnection, QueryOptions } from 'mysql2/promise';
import type { SQLWrapper } from '~/sql.ts';
import type { Dialect } from '../../sql-template-params.ts';
import { SQLTemplate } from '../../sql-template.ts';
import { isPool } from './utils.ts';

// CallbackConnection will be used in stream method

export class MySql2SQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sql: SQLWrapper,
		protected readonly client: Pool | Connection,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
		private queryConfig: QueryOptions = {
			sql: sql.getQuery().query,
		},
		private rawQueryConfig: QueryOptions = {
			sql: sql.getQuery().query,
			rowsAsArray: true,
		},
	) {
		super(sql, dialect);
	}

	async execute() {
		const { params } = this.sql.getQuery();
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? (this.client as Pool | Connection).query(this.rawQueryConfig, params)
				: (this.client as Pool | Connection).query(this.queryConfig, params));

			return queryResult[0] as T[];
		} catch (error) {
			const queryStr = `\nquery: '${this.queryConfig.sql}'\n`;
			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);

			newError.cause = (error as Error).cause;
			newError.stack = (error as Error).stack ? queryStr + (error as Error).stack : (error as Error).stack;

			throw newError;
		}
	}

	async *stream() {
		let conn: CallbackConnection | undefined;
		// wrapping mysql2 driver error in new js error to add stack trace to it
		try {
			const { params } = this.sql.getQuery();

			const conn = ((isPool(this.client) ? await this.client.getConnection() : this.client) as object as {
				connection: CallbackConnection;
			}).connection;

			const stream = conn.query(this.queryConfig, params).stream();
			for await (const row of stream) {
				yield row;
			}

			if (isPool(this.client)) {
				// using release instead of end because mysql stderr:
				// calling conn.end() to release a pooled connection is deprecated.
				// In next version calling conn.end() will be restored to default conn.end() behavior. Use conn.release() instead.
				(conn as object as PoolConnection).release();
			}
		} catch (error) {
			if (isPool(this.client)) {
				(conn as object as PoolConnection)?.release();
			}

			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);

			newError.cause = (error as Error).cause;
			newError.stack = (error as Error).stack;

			throw newError;
		}
	}
}
