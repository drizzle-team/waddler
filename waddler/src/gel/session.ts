import type { Client } from 'gel';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { GelDialect } from './gel-core/dialect.ts';

export class GelSQLTemplate<T> extends SQLTemplate<T> {
	private isQuerySQL: boolean = true;
	constructor(
		override sql: SQLWrapper,
		protected readonly client: Client,
		dialect: GelDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	query(): Omit<GelSQLTemplate<T>, 'query' | 'querySQL'> {
		this.isQuerySQL = false;
		return this;
	}

	querySQL(): Omit<GelSQLTemplate<T>, 'query' | 'querySQL'> {
		this.isQuerySQL = true;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		try {
			if (!this.isQuerySQL) {
				if (this.options.rowMode === 'array') {
					const res = await this.client.withSQLRowMode('array').query(query, params.length ? params : undefined);
					return res as T[];
				} else {
					const res = await this.client.query(query, params.length ? params : undefined);
					return res as T[];
				}
			}

			if (this.options.rowMode === 'array') {
				const rows = await this.client.withSQLRowMode('array').querySQL(query, params.length ? params : undefined);
				return rows as T[];
			}

			const rows = await this.client.querySQL(query, params.length ? params : undefined);
			return rows as T[];
		} catch (error) {
			// TODO revise: somehow newError does not display query in console.
			const queryStr = `\nquery: '${query}'\n`;
			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);

			newError.cause = (error as Error).cause;
			newError.stack = (error as Error).stack ? queryStr + (error as Error).stack : (error as Error).stack;

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
