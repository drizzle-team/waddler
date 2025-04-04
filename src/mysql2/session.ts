import type { Connection as CallbackConnection, Pool as CallbackPool } from 'mysql2';
import type { Connection, Pool, QueryOptions } from 'mysql2/promise';
import type { SQLWrapper } from '~/sql.ts';
import type { Dialect } from '../sql-template-params.ts';
import { SQLTemplate } from '../sql-template.ts';

// CallbackBasedPool | CallbackBasedConnection will be used in stream method
export type MySql2Client = Pool | Connection | CallbackConnection | CallbackPool;

export type CallbackBasedMySql2Client = CallbackConnection;

export class MySql2SQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: MySql2Client,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
		private queryConfig: QueryOptions = {
			sql: sql.getQuery().query,
			// rowsAsArray: true,
			typeCast: function(field: any, next: any) {
				if (field.type === 'TIMESTAMP' || field.type === 'DATETIME' || field.type === 'DATE') {
					return field.string();
				}
				return next();
			},
		},
		private rawQueryConfig: QueryOptions = {
			sql: sql.getQuery().query,
			rowsAsArray: true,
			typeCast: function(field: any, next: any) {
				if (field.type === 'TIMESTAMP' || field.type === 'DATETIME' || field.type === 'DATE') {
					return field.string();
				}
				return next();
			},
		},
	) {
		super(sql, dialect);
	}

	async execute() {
		const { params } = this.sql.getQuery();
		try {
			if (['PromiseConnection', 'PromisePool'].includes(this.client.constructor.name)) {
				const queryResult = await (this.options.rowMode === 'array'
					? (this.client as Pool | Connection).query(this.rawQueryConfig, params)
					: (this.client as Pool | Connection).query(this.queryConfig, params));

				return queryResult[0] as T[];
			} else {
				// TODO: revise: maybe I should promisify the callback-based client.query
				throw new Error(
					`For now, you can use the callback-based client only for the stream method. Please provide waddler with a promise-based client.`,
				);
			}
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}

	async *stream() {
		// let conn: CallbackBasedMySql2Client | undefined;
		// wrapping node-postgres driver error in new js error to add stack trace to it
		try {
			// pool.connect() if this.client is Pool
			// conn = this.client instanceof Pool
			// 	? await this.client.conn()
			// 	: this.client;
			const { params } = this.sql.getQuery();

			if (this.client.query.constructor.name === 'Promise') {
				console.warn(
					`'stream' method is implemented as a placeholder for promise-based client.`
						+ `\n(the method executes the query, loads the result into memory, and iterates over it to simulate streaming.)`
						+ `\nIf you want stream data, please use callback-based client.`,
				);
				const queryResult = await (this.client as Pool | Connection).query(this.queryConfig, params);
				for (const row of queryResult[0] as T[]) {
					yield row;
				}
			} else {
				const stream = (this.client as CallbackConnection).query(this.queryConfig, params).stream();
				for await (const row of stream) {
					yield row;
				}
			}

			// if (this.client instanceof Pool) {
			// 	(conn as PoolClient).release();
			// }
		} catch (error) {
			// if (this.client instanceof Pool) {
			// 	(conn as PoolClient)?.release();
			// }

			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}
}
