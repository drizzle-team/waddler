/// <reference types="@cloudflare/workers-types" />

import type { SQLWrapper } from '~/sql.ts';
import type { SqliteDialect } from '~/sqlite-core/dialect.ts';
import { SQLTemplate } from '../sql-template.ts';

export class D1SQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: D1Database,
		dialect: SqliteDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	all(): Omit<D1SQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<D1SQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping d1 driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);
			if (this.returningData) {
				if (this.options.rowMode === 'array') {
					return (await stmt.bind(...params).raw()) as T[];
				}

				return await stmt.bind(...params).all().then(({ results }) => results as T[]);
			} else {
				return (await stmt.bind(...params).run()) as any;
			}
		} catch (error) {
			const queryStr = `\nquery: '${query}'\n`;

			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);
			newError.cause = (error as Error).cause;
			newError.stack = (error as Error).stack;

			throw newError;
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once cloudflare d1 driver acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for d1 yet.');
	}
}
