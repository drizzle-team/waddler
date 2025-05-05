import type { SQL } from 'bun';
import type { PgDialect } from '~/pg/pg-core/dialect.ts';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class BunSqlSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sql: SQLWrapper,
		protected readonly client: SQL,
		dialect: PgDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping bun-sql driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.unsafe(query, params).values();
				return queryResult as T[];
			}

			const queryResult = await this.client.unsafe(query, params);
			return queryResult as T[];
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
	 * Current implementation (a placeholder) will be replaced once bun's postgres driver acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for bun-sql yet.');
	}
}
