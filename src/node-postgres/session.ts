import type { Client as ClientT, Pool as PoolT, PoolClient, QueryArrayConfig, QueryConfig } from 'pg';
import pg from 'pg';
import type { WaddlerConfig } from '../extensions.ts';
import type { Dialect, SQLChunk } from '../sql-template-params.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { UnsafeParamType } from '../types.ts';
import type { NodePgClient } from './driver.ts';

const { Pool, types } = pg;

export class NodePgSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected override query: string,
		protected override params: UnsafeParamType[],
		protected readonly client: NodePgClient,
		dialect: Dialect,
		queryChunks: SQLChunk[],
		configOptions: WaddlerConfig,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
		private queryConfig: QueryConfig = {
			text: query,
			types: {
				// @ts-expect-error
				getTypeParser: (typeId: number, format: string) => {
					if (typeId === types.builtins.INTERVAL) return (val: any) => val;
					if (typeId === 1187) return (val: any) => val;
					// @ts-expect-error
					return types.getTypeParser(typeId, format);
				},
			},
		},
		private rawQueryConfig: QueryArrayConfig = {
			text: query,
			rowMode: 'array',
			types: {
				// @ts-expect-error
				getTypeParser: (typeId: number, format: string) => {
					if (typeId === types.builtins.INTERVAL) return (val: any) => val;
					if (typeId === 1187) return (val: any) => val;
					// @ts-expect-error
					return types.getTypeParser(typeId, format);
				},
			},
		},
	) {
		super(query, params, dialect, queryChunks, configOptions);
	}

	async execute() {
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.query(this.rawQueryConfig, this.params)
				: this.client.query(this.queryConfig, this.params));

			return queryResult.rows;
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}

	// TODO: revise: maybe I should override chunked method because we can use QueryStream with option 'batchSize' in QueryStreamConfig
	async *stream() {
		let conn: ClientT | PoolT | PoolClient | undefined;
		// wrapping node-postgres driver error in new js error to add stack trace to it
		try {
			// pool.connect() if this.client is Pool
			conn = this.client instanceof Pool
				? await this.client.connect()
				: this.client;

			const queryStreamObj = this.configOptions?.extensions?.find((it) => it.name === 'WaddlerPgQueryStream');
			// If no extensions were defined, or some were defined but did not include WaddlerPgQueryStream, we should throw an error.
			if (!queryStreamObj) {
				throw new Error(
					'To use stream feature, you would need to provide queryStream() function to waddler extensions, example: waddler("", { extensions: [queryStream()] })',
				);
			}

			// QueryStream constructor:
			// constructor(text: string, values?: any[], config?: QueryStreamConfig);
			const queryStream = new queryStreamObj.constructor(this.query, this.params, { types: this.queryConfig.types });

			const stream = conn.query(queryStream);

			for await (const row of stream) {
				yield row;
			}

			if (this.client instanceof Pool) {
				(conn as PoolClient).release();
			}
		} catch (error) {
			if (this.client instanceof Pool) {
				(conn as PoolClient)?.release();
			}

			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}
}
