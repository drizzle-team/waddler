import type { Connection, ExecuteOptions, FullResult } from '@tidbcloud/serverless';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { MySQLDialect } from '../mysql-core/dialect.ts';

const executeRawConfig = { fullResult: true } satisfies ExecuteOptions;
const queryConfig = { arrayMode: true } satisfies ExecuteOptions;

export class TidbServerlessSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Connection, // TODO should I include Tx here?
		dialect: MySQLDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	async execute() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		this.logger.logQuery(query, params);

		try {
			if (this.options.rowMode === 'array') {
				const rows = await this.client.execute(query, params, queryConfig) as T[];
				return rows;
			}

			const res = await this.client.execute(query, params, executeRawConfig) as FullResult;
			return res.rows as T[];
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
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
