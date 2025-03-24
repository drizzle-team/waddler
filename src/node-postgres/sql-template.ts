import type { Client as ClientT, Pool as PoolT, PoolClient } from 'pg';
import pg from 'pg';
import QueryStream from 'pg-query-stream';
import { SQLTemplate } from '../sql-template.ts';
import type { NodePgSQLParamType } from './types.ts';
import { dbQuery } from './utils.ts';

const { Pool, types } = pg;

export class NodePgSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected strings: readonly string[],
		protected params: NodePgSQLParamType[],
		protected readonly client: ClientT | PoolT,
	) {
		super();
		this.strings = strings;
		this.params = params;
	}

	protected async executeQuery() {
		// Implement your actual DB execution logic here
		// This could be a fetch or another async operation
		// gets connection from pool, runs query, release connection
		const { query, params } = this.toSQL();
		let result;

		// wrapping node-postgres driver error in new js error to add stack trace to it
		try {
			result = (await dbQuery(
				this.client,
				query,
				params,
				{ rowMode: 'object' },
			)) as T[];
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}

		return result;
	}

	async *stream() {
		const { query, params } = this.toSQL();

		// pool.connect() if this.client is Pool
		const conn: ClientT | PoolT | PoolClient = this.client instanceof Pool ? await this.client.connect() : this.client;

		// wrapping node-postgres driver error in new js error to add stack trace to it
		try {
			const queryStream = new QueryStream(query, params, {
				types: {
					getTypeParser: (typeId: number, format: string) => {
						if (typeId === types.builtins.INTERVAL) return (val: any) => val;
						if (typeId === 1187) return (val: any) => val;
						// @ts-expect-error
						return types.getTypeParser(typeId, format);
					},
				},
			});

			const stream = conn.query(queryStream);

			for await (const row of stream) {
				yield row;
			}

			if (this.client instanceof Pool) {
				(conn as PoolClient).release();
			}
		} catch (error) {
			if (this.client instanceof Pool) {
				(conn as PoolClient).release();
			}

			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}
}
