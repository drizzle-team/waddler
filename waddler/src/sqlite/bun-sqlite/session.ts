import type { Database } from 'bun:sqlite';
import type { SQLWrapper } from '~/sql.ts';
import type { SqliteDialect } from '~/sqlite/sqlite-core/dialect.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class BunSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Database,
		dialect: SqliteDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
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
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes, finalMetadata: any | undefined;

		// wrapping bun-sqlite driver error in new js error to add stack trace to it
		try {
			const stmt = this.client.prepare(query);
			if (this.returningData) {
				finalRes = this.options.rowMode === 'array'
					? stmt.values(...params as any[])
					: stmt.all(...params as any) as T[];
			} else {
				// TODO revise: it might cause unexpected behavior because finalRes and finalMetadata store the same reference of object
				finalRes = stmt.run(...params as any[]);
				finalMetadata = finalRes;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);

		return finalRes as T[];
	}

	async *stream() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		this.logger.logQuery(query, params);

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
