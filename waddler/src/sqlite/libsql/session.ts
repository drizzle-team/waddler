import type { Client, InArgs, InStatement } from '@libsql/client';

import type { SQLWrapper } from '~/sql.ts';
import type { SqliteDialect } from '~/sqlite/sqlite-core/dialect.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class LibsqlSQLTemplate<T> extends SQLTemplate<T> {
	returningData: boolean = true;

	constructor(
		public override sql: SQLWrapper,
		public readonly client: Client,
		dialect: SqliteDialect,
		public options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	all(): Omit<LibsqlSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<LibsqlSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();

		// wrapping libsql driver error in new js error to add stack trace to it
		try {
			const stmt: InStatement = { sql: query, args: params as InArgs };
			if (this.returningData) {
				if (this.options.rowMode === 'array') {
					const queryResult = await this.client.execute(stmt);
					// TODO revise: should I map array of objects to array of arrays manually if driver doesn't support it?
					const rows = queryResult.rows.map((row) => queryResult.columns.map((col) => row[col]));
					return rows as T[];
				}
				return (await this.client.execute(stmt).then(({ rows }) => rows)) as T[];
			} else {
				return (await this.client.execute(stmt)) as any;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
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
