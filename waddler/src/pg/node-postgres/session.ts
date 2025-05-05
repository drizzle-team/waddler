import type { Client as ClientT, Pool as PoolT, PoolClient, QueryArrayConfig, QueryConfig } from 'pg';
import pg from 'pg';
import type { SQLWrapper } from '~/sql.ts';
import type { WaddlerConfig } from '../../extensions';
import { SQLTemplate } from '../../sql-template.ts';
import type { PgDialect } from '../pg-core/dialect.ts';
import type { NodePgClient } from './driver.ts';

const { Pool, types } = pg;

const pgTypeConfig: pg.CustomTypesConfig = {
	// @ts-expect-error
	getTypeParser: (typeId: number, format: string) => {
		if (typeId === types.builtins.INTERVAL) return (val: any) => val;
		if (typeId === 1187) return (val: any) => val;
		// @ts-expect-error
		return types.getTypeParser(typeId, format);
	},
};

export class NodePgSQLTemplate<T> extends SQLTemplate<T> {
	private queryConfig: QueryConfig;
	private rawQueryConfig: QueryArrayConfig;

	constructor(
		override sql: SQLWrapper,
		protected readonly client: NodePgClient,
		dialect: PgDialect,
		configOptions: WaddlerConfig,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect, configOptions);
		const query = this.sql.getQuery().query;
		this.queryConfig = {
			text: query,
			types: pgTypeConfig,
		};
		this.rawQueryConfig = {
			rowMode: 'array',
			text: query,
			types: pgTypeConfig,
		};
	}

	async execute() {
		const { params } = this.sql.getQuery();
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.query(this.rawQueryConfig, params)
				: this.client.query(this.queryConfig, params));

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

			const { query, params } = this.sql.getQuery();
			const queryStream = new queryStreamObj.constructor(query, params, { types: this.queryConfig.types });

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
