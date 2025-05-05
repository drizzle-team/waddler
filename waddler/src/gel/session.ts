import type { Client } from 'gel';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { GelDialect } from './gel-core/dialect.ts';

export class GelSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sql: SQLWrapper,
		protected readonly client: Client,
		dialect: GelDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		try {
			if (this.options.rowMode === 'array') {
				const rows = await this.client.withSQLRowMode('array').querySQL(query, params.length ? params : undefined);
				return rows as T[];
			}

			const rows = await this.client.querySQL(query, params.length ? params : undefined);
			return rows as T[];
		} catch (error) {
			console.log(query);
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);

			newError.cause = (error as Error).cause;
			newError.stack = (error as Error).stack;

			throw newError;
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once gel acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		throw new Error('stream is not implemented for gel yet.');
	}
}
