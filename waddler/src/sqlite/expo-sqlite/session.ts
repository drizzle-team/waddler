import type { SQLiteDatabase } from 'expo-sqlite';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';

export class ExpoSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: SQLiteDatabase,
		dialect: SqliteDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
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
		const { query, params } = this.sqlWrapper.getQuery();

		const stmt = this.client.prepareSync(query);
		// wrapping expo-sqlite driver error in new js error to add stack trace to it
		try {
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
			throw new WaddlerQueryError(query, params, error as Error);
		} finally {
			await stmt.finalizeAsync();
		}
	}

	async *stream() {
		const { query, params } = this.sqlWrapper.getQuery();
		const stmt = this.client.prepareSync(query);

		// wrapping expo-sqlite driver error in new js error to add stack trace to it
		try {
			const stream = await (this.options.rowMode === 'array'
				? stmt.executeForRawResultAsync(params)
				: stmt.executeAsync(params));

			// const stream = this.client.getEachAsync(query, params);

			for await (const row of stream) {
				yield row as T;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		} finally {
			await stmt.finalizeAsync();
		}
	}
}
