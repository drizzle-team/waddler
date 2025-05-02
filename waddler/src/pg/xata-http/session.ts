import type { SQLPluginResult } from '@xata.io/client';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { PgDialect } from '../pg-core/index.ts';

export type XataHttpClient = {
	sql: SQLPluginResult;
};

export class XataHttpSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: XataHttpClient,
		dialect: PgDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		// wrapping xata-http driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.sql({ statement: query, params, responseType: 'array' });
				return queryResult.rows as T[];
			}

			const queryResult = await this.client.sql({ statement: query, params, responseType: 'json' });
			return queryResult.records as T[];
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once @xata.io/client acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for xata-http yet.');
	}
}
