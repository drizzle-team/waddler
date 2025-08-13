import type { DB } from '@op-engineering/op-sqlite';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SqliteDialect } from '../sqlite-core/dialect.ts';

export class OpSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: DB,
		dialect: SqliteDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
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
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes, finalMetadata: any | undefined;

		// TODO: do I really need branching to all and run here?
		// wrapping op-sqlite driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				finalRes = await this.client.executeRaw(query, params);
			} else {
				const queryResult = await this.client.execute(query, params);
				({ rows: finalRes, ...finalMetadata } = queryResult);
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);

		return finalRes as T[];
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
