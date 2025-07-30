import type { Connection as CallbackConnection } from 'mysql2';
import type { Connection, Pool, PoolConnection, QueryOptions } from 'mysql2/promise';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { Dialect } from '../../sql-template-params.ts';
import { SQLTemplate } from '../../sql-template.ts';
import { isPool } from './utils.ts';

// CallbackConnection will be used in stream method

export class MySql2SQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Pool | Connection,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
		private queryConfig: QueryOptions = {
			sql: sqlWrapper.getQuery().query,
		},
		private rawQueryConfig: QueryOptions = {
			sql: sqlWrapper.getQuery().query,
			rowsAsArray: true,
		},
	) {
		super(sqlWrapper, dialect);
	}

	async execute() {
		const { params } = this.sqlWrapper.getQuery();
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? (this.client as Pool | Connection).query(this.rawQueryConfig, params)
				: (this.client as Pool | Connection).query(this.queryConfig, params));

			return queryResult[0] as T[];
		} catch (error) {
			throw new WaddlerQueryError(this.queryConfig.sql, params, error as Error);
		}
	}

	async *stream() {
		let conn: CallbackConnection | undefined;
		const { params } = this.sqlWrapper.getQuery();
		// wrapping mysql2 driver error in new js error to add stack trace to it
		try {
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

			throw new WaddlerQueryError(this.queryConfig.sql, params, error as Error);
		}
	}
}
