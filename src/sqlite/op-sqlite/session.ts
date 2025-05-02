import type { DB } from '@op-engineering/op-sqlite';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';

export class OpSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: DB,
		dialect: SqliteDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	all(): Omit<OpSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<OpSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// TODO: do I really need branching to all and run here?
		// wrapping op-sqlite driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const rows = await this.client.executeRaw(query, params);
				return rows as T[];
			}
			const queryResult = await this.client.execute(query, params);
			return queryResult.rows as T[];
		} catch (error) {
			const queryStr = `\nquery: '${query}'\n`;

			const newError = error instanceof AggregateError
				? new Error(queryStr + error.errors.map((e) => e.message).join('\n'))
				: new Error(queryStr + (error as Error).message);
			throw newError;
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once cloudflare op-sqlite driver acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for op-sqlite yet.');
	}
}
