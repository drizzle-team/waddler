import type { Database } from 'better-sqlite3';
import type { Dialect } from '~/sql-template-params.ts';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../sql-template.ts';

export class BetterSqlite3SQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: Database,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	all(): Omit<BetterSqlite3SQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<BetterSqlite3SQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping better-sqlite3 driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);
			if (this.returningData) {
				if (this.options.rowMode === 'array') {
					return stmt.raw().all(...params) as T[];
				}

				return stmt.all(...params) as T[];
			} else {
				return stmt.run(...params) as any;
			}
		} catch (error) {
			const queryStr = `\nquery: '${query}'\n`;

			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);
			throw newError;
		}
	}

	async *stream() {
		const { query, params } = this.sql.getQuery();

		// wrapping better-sqlite3 driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);

			const stream = this.options.rowMode === 'array' ? stmt.raw().iterate(...params) : stmt.iterate(...params);

			for await (const row of stream) {
				yield row as T;
			}
		} catch (error) {
			const queryStr = `\nquery: '${query}'\n`;

			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);
			throw newError;
		}
	}
}
