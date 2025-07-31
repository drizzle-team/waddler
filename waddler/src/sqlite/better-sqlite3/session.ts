import type { Database } from 'better-sqlite3';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';

export class BetterSqlite3SQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Database,
		dialect: SqliteDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
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
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);

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
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	async *stream() {
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);

		// wrapping better-sqlite3 driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);

			const stream = this.options.rowMode === 'array' ? stmt.raw().iterate(...params) : stmt.iterate(...params);

			for await (const row of stream) {
				yield row as T;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
