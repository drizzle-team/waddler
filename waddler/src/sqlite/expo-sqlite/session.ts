import type { SQLiteDatabase } from 'expo-sqlite';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';

export class ExpoSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: SQLiteDatabase,
		dialect: SqliteDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
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
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes, finalMetadata: any | undefined;

		const stmt = this.client.prepareSync(query);
		// wrapping expo-sqlite driver error in new js error to add stack trace to it
		try {
			if (this.returningData === true) {
				if (this.options.rowMode === 'array') {
					const queryResult = stmt.executeForRawResultSync(params as any[]);

					finalRes = queryResult.getAllSync();
					finalMetadata = { changes: queryResult.changes, lastInsertRowId: queryResult.lastInsertRowId };
				} else {
					const queryResult = stmt.executeSync(params as any[]);

					finalRes = queryResult.getAllSync();
					finalMetadata = { changes: queryResult.changes, lastInsertRowId: queryResult.lastInsertRowId };
				}
			} else {
				const queryResult = await stmt.executeAsync(params);
				finalMetadata = { changes: queryResult.changes, lastInsertRowId: queryResult.lastInsertRowId };
				finalRes = queryResult;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		} finally {
			await stmt.finalizeAsync();
		}

		this.logger.logQuery(query, params, finalMetadata);

		return finalRes as T[];
	}

	async *stream() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);

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
