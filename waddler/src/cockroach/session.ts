import type { Client as ClientT, Pool as PoolT, PoolClient, QueryArrayConfig, QueryConfig } from 'pg';
import pg from 'pg';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../sql-template.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { CockroachDialect } from './cockroach-core/dialect.ts';
import type { CockroachClient } from './driver.ts';

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

export class CockroachSQLTemplate<T> extends SQLTemplate<T> {
	private queryConfig: QueryConfig;
	private rawQueryConfig: QueryArrayConfig;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: CockroachClient,
		dialect: CockroachDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
		const query = this.sqlWrapper.getQuery(this.dialect).sql;
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
		const { params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes, finalMetadata: any | undefined;
		try {
			const queryResult = this.options.rowMode === 'array'
				? await (this.client.query(this.rawQueryConfig, params))
				: await (this.client.query(this.queryConfig, params));

			({ rows: finalRes, ...finalMetadata } = queryResult);
		} catch (error) {
			throw new WaddlerQueryError(this.queryConfig.text, params, error as Error);
		}

		this.logger.logQuery(this.queryConfig.text, params, finalMetadata);

		return finalRes as T[];
	}

	// TODO: revise: maybe I should override chunked method because we can use QueryStream with option 'batchSize' in QueryStreamConfig
	async *stream() {
		let conn: ClientT | PoolT | PoolClient | undefined;
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);

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

			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
