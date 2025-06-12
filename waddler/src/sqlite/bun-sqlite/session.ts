import type { Database } from 'bun:sqlite';
import type { SQLWrapper } from '~/sql.ts';
import type { SqliteDialect } from '~/sqlite/sqlite-core/dialect.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class BunSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sql: SQLWrapper,
		protected readonly client: Database,
		dialect: SqliteDialect,
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
					return stmt.values(...params as any[]) as T[];
				}

				return stmt.all(...params as any) as T[];
			} else {
				return stmt.run(...params as any[]) as any;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
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
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
