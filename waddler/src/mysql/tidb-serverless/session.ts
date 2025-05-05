import type { Connection, ExecuteOptions, FullResult } from '@tidbcloud/serverless';
import type { SQLWrapper } from '~/sql.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { MySQLDialect } from '../mysql-core/dialect.ts';

const executeRawConfig = { fullResult: true } satisfies ExecuteOptions;
const queryConfig = { arrayMode: true } satisfies ExecuteOptions;

export class TidbServerlessSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sql: SQLWrapper,
		protected readonly client: Connection, // TODO should I include Tx here?
		dialect: MySQLDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		try {
			if (this.options.rowMode === 'array') {
				const rows = await this.client.execute(query, params, queryConfig) as T[];
				return rows;
			}

			const res = await this.client.execute(query, params, executeRawConfig) as FullResult;
			return res.rows as T[];
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);

			newError.cause = (error as Error).cause;
			newError.stack = (error as Error).stack;

			throw newError;
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once tidb-serverless driver acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for tidb-serverless yet.');
	}
}
