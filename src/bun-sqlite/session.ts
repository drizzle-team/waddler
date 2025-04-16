import type { Database } from 'bun:sqlite';
import type { Dialect } from '~/sql-template-params.ts';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../sql-template.ts';

export class BunSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: Database,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	all(): Omit<BunSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<BunSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping bun-sqlite driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);
			if (this.returningData) {
				if (this.options.rowMode === 'array') {
					// TODO revise: is it okay to use 'as any[]' here
					return stmt.values(...params as any[]) as T[];
				}

				return stmt.all(...params as any) as T[];
			} else {
				// TODO: revise: there is no point in branching here because stmt.run should not return data.
				// if (this.options.rowMode === 'array') {
				// 	return stmt.run(...params as any[]) as any;
				// }

				return stmt.run(...params as any[]) as any;
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

		// wrapping bun-sqlite driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);

			const stream = stmt.iterate(...params as any[]);

			for await (const row of stream) {
				if (this.options.rowMode === 'array') {
					const rowValues = stmt.columnNames.map((colName) => (row as Record<string, any>)[colName]);
					yield rowValues as T;
				} else {
					yield row as T;
				}
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
