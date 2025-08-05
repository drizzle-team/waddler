import type { Client as ClientT, Pool as PoolT, PoolClient, QueryArrayConfig, QueryConfig } from 'pg';
import pg from 'pg';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
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
		override sqlWrapper: SQLWrapper,
		protected readonly client: NodePgClient,
		dialect: PgDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
		const query = this.sqlWrapper.getQuery(this.dialect).query;
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
		this.logger.logQuery(this.queryConfig.text, params);
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.query(this.rawQueryConfig, params)
				: this.client.query(this.queryConfig, params));

			return queryResult.rows;
		} catch (error) {
			throw new WaddlerQueryError(this.queryConfig.text, params, error as Error);
		}
	}

	// TODO: revise: maybe I should override chunked method because we can use QueryStream with option 'batchSize' in QueryStreamConfig
	async *stream() {
		let conn: ClientT | PoolT | PoolClient | undefined;
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);
		this.logger.logQuery(this.queryConfig.text, params);

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
