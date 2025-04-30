import type { SQLiteDatabase } from 'expo-sqlite';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';

export class ExpoSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: SQLiteDatabase,
		dialect: SqliteDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	all(): Omit<ExpoSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<ExpoSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping op-sqlite driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepareSync(query);
			if (this.returningData === false) {
				return await stmt.executeAsync(params) as any;
			}

			if (this.returningData === true) {
				if (this.options.rowMode === 'array') {
					const rows = stmt.executeForRawResultSync(params as any[]).getAllSync();
					return rows as T[];
				}
				return stmt.executeSync(params as any[]).getAllSync() as T[];
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
			// const stmt = this.client.prepareSync(query);
			// const stream = await (this.options.rowMode === 'array'
			// 	? stmt.executeForRawResultAsync(params)
			// 	: stmt.executeAsync(params));

			// const stream = this.options.rowMode === 'array' ? stmt.raw().iterate(...params) : stmt.iterate(...params);
			const stream = this.client.getEachAsync(query, params);

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
