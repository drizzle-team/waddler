import {
	type Client,
	type HTTPQueryOptions,
	type Pool,
	type PoolClient,
	type QueryArrayConfig,
	type QueryConfig,
	types,
} from '@neondatabase/serverless';

import type { PgDialect } from '~/pg/pg-core/dialect.ts';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { WaddlerConfig } from '../../extensions';
import { SQLTemplate } from '../../sql-template.ts';

export type NeonClient = Pool | PoolClient | Client;

const pgTypeConfig: Required<HTTPQueryOptions<any, any>['types']> = {
	// @ts-expect-error
	getTypeParser: (typeId: number, format: string) => {
		if (typeId === types.builtins.INTERVAL) return (val: any) => val;
		if (typeId === 1187) return (val: any) => val;
		// @ts-expect-error
		return types.getTypeParser(typeId, format);
	},
};

export class NeonServerlessSQLTemplate<T> extends SQLTemplate<T> {
	private rawQueryConfig: QueryConfig;
	private queryConfig: QueryArrayConfig;

	constructor(
		override sql: SQLWrapper,
		protected readonly client: NeonClient,
		dialect: PgDialect,
		configOptions: WaddlerConfig,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect, configOptions);

		const query = this.sql.getQuery().query;
		this.rawQueryConfig = {
			text: query,
			types: pgTypeConfig,
		};
		this.queryConfig = {
			rowMode: 'array',
			text: query,
			types: pgTypeConfig,
		};
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping neon-serverless driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.query(
					this.queryConfig,
					params,
				);
				return queryResult.rows as T[];
			} else {
				const queryResult = await this.client.query(
					this.rawQueryConfig,
					params,
				);
				return queryResult.rows as T[];
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	async *stream() {
		const queryStreamObj = this.configOptions?.extensions?.find((it) => it.name === 'WaddlerPgQueryStream');
		// If no extensions were defined, or some were defined but did not include WaddlerPgQueryStream, we should throw an error.
		if (!queryStreamObj) {
			throw new Error(
				'To use stream feature, you would need to provide queryStream() function to waddler extensions, example: waddler("", { extensions: [queryStream()] })',
			);
		}

		const { query, params } = this.sql.getQuery();
		const queryStream = new queryStreamObj.constructor(query, params, {
			types: this.queryConfig.types,
			// rowMode: 'array',
		});

		try {
			const stream = this.client.query(queryStream);
			for await (const row of stream) {
				yield row;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
