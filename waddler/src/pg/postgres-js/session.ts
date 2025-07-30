import type { RowList, Sql } from 'postgres';
import type { PgDialect } from '~/pg/pg-core/dialect.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SQLWrapper } from '../../sql.ts';

export class PostgresSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Sql,
		dialect: PgDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
	}

	async execute() {
		const { query, params } = this.sqlWrapper.getQuery();
		// wrapping postgres-js driver error in new js error to add stack trace to it
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.unsafe(query, params as any[]).values()
				: this.client.unsafe(query, params as any[]));

			// TODO check if cast to RowList<T[]> is valid
			return queryResult as RowList<T[]> as T[];
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once Postgre.js acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for postgres-js yet.');
	}
}
