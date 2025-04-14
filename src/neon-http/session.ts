import { type HTTPQueryOptions, type NeonQueryFunction, types } from '@neondatabase/serverless';
import type { Dialect } from '~/sql-template-params.ts';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../sql-template.ts';

export type NeonHttpClient = NeonQueryFunction<any, any>;

const pgTypeConfig: Required<HTTPQueryOptions<any, any>['types']> = {
	// @ts-expect-error
	getTypeParser: (typeId: number, format: string) => {
		if (typeId === types.builtins.INTERVAL) return (val: any) => val;
		if (typeId === 1187) return (val: any) => val;
		// @ts-expect-error
		return types.getTypeParser(typeId, format);
	},
};

const rawQueryConfig: HTTPQueryOptions<false, true> = {
	arrayMode: false,
	fullResults: true,
	types: pgTypeConfig,
};

const queryConfig: HTTPQueryOptions<true, true> = {
	arrayMode: true,
	fullResults: true,
	types: pgTypeConfig,
};

export type NeonAuthToken = string | (() => string | Promise<string>);

export class NeonHttpSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: NeonHttpClient,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object'; token?: NeonAuthToken } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping neon-http driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.query(
					query,
					params,
					this.options.token === undefined ? queryConfig : { ...queryConfig, authToken: this.options.token! },
				);
				return queryResult.rows as T[];
			} else {
				const queryResult = await this.client.query(
					query,
					params,
					this.options.token === undefined ? rawQueryConfig : { ...rawQueryConfig, authToken: this.options.token! },
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
		// TODO not implemented yet
		throw new Error('stream is not implemented for neon-http yet.');
	}
}
