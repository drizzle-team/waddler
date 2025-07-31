import type { SQL } from 'bun';
import type { PgDialect } from '~/pg/pg-core/dialect.ts';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class BunSqlSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: SQL,
		dialect: PgDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
	}

	async execute() {
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);

		// wrapping bun-sql driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.unsafe(query, params).values();
				return queryResult as T[];
			}

			const queryResult = await this.client.unsafe(query, params);
			return queryResult as T[];
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once bun's postgres driver acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for bun-sql yet.');
	}
}
