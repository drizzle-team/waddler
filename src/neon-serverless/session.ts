import {
	type Client,
	type HTTPQueryOptions,
	type Pool,
	type PoolClient,
	type QueryArrayConfig,
	type QueryConfig,
	types,
} from '@neondatabase/serverless';

import type { Dialect } from '~/sql-template-params.ts';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../sql-template.ts';

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
		protected override sql: SQLWrapper,
		protected readonly client: NeonClient,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);

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
			const queryStr = `\nquery: '${query}'\n`;

			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);
			throw newError;
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once @neondatabase/serverless acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		throw new Error('stream is not implemented for neon-serverless yet.');
	}
}
