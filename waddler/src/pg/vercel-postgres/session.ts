import type { QueryArrayConfig, QueryConfig, VercelClient, VercelPoolClient } from '@vercel/postgres';
import { types, VercelPool } from '@vercel/postgres';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { WaddlerConfig } from '../../extensions';
import { SQLTemplate } from '../../sql-template.ts';
import type { PgDialect } from '../pg-core/index.ts';

export type VercelPgClient = VercelPool | VercelClient | VercelPoolClient;

const pgTypeConfig: Required<QueryConfig['types']> = {
	// @ts-expect-error
	getTypeParser: (typeId: number, format: string) => {
		if (typeId === types.builtins.INTERVAL) return (val: any) => val;
		if (typeId === 1187) return (val: any) => val;
		// @ts-expect-error
		return types.getTypeParser(typeId, format);
	},
};

export class VercelPgSQLTemplate<T> extends SQLTemplate<T> {
	private rawQueryConfig: QueryConfig;
	private queryConfig: QueryArrayConfig;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: VercelPgClient,
		dialect: PgDialect,
		configOptions: WaddlerConfig,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
		const query = this.sqlWrapper.getQuery().query;
		this.queryConfig = {
			rowMode: 'array',
			text: query,
			types: pgTypeConfig,
		};
		this.rawQueryConfig = {
			text: query,
			types: pgTypeConfig,
		};
	}

	async execute() {
		const { params } = this.sqlWrapper.getQuery();
		// wrapping vercel-postgres driver error in new js error to add stack trace to it
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.query(this.queryConfig, params)
				: this.client.query(this.rawQueryConfig, params));

			return queryResult.rows;
		} catch (error) {
			throw new WaddlerQueryError(this.queryConfig.text, params, error as Error);
		}
	}

	// TODO: revise: maybe I should override chunked method because we can use QueryStream with option 'batchSize' in QueryStreamConfig
	async *stream() {
		let conn: VercelPoolClient | VercelClient | undefined;
		let query: string = '', params: any[] = [];
		// wrapping vercel-postgres driver error in new js error to add stack trace to it
		try {
			conn = this.client instanceof VercelPool
				? await this.client.connect()
				: this.client;

			const queryStreamObj = this.configOptions?.extensions?.find((it) => it.name === 'WaddlerPgQueryStream');
			// If no extensions were defined, or some were defined but did not include WaddlerPgQueryStream, we should throw an error.
			if (!queryStreamObj) {
				throw new Error(
					'To use stream feature, you would need to provide queryStream() function to waddler extensions, example: waddler("", { extensions: [queryStream()] })',
				);
			}

			({ query, params } = this.sqlWrapper.getQuery());
			const queryStream = new queryStreamObj.constructor(query, params, { types: this.queryConfig.types });

			const stream = conn.query(queryStream);

			for await (const row of stream) {
				yield row;
			}

			if (this.client instanceof VercelPool) {
				(conn as VercelPoolClient).release();
			}
		} catch (error) {
			if (this.client instanceof VercelPool) {
				(conn as VercelPoolClient)?.release();
			}

			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
