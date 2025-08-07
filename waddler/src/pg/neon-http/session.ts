import { type HTTPQueryOptions, type NeonQueryFunction, types } from '@neondatabase/serverless';
import type { Dialect } from '~/sql-template-params.ts';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';

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

export class NeonHttpSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: NeonHttpClient,
		dialect: Dialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	async execute() {
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);
		this.logger.logQuery(query, params);

		// wrapping neon-http driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.query(
					query,
					params,
					queryConfig,
				);
				return queryResult.rows as T[];
			} else {
				const queryResult = await this.client.query(
					query,
					params,
					rawQueryConfig,
				);
				return queryResult.rows as T[];
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
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
