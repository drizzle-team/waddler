import type { SQLPluginResult } from '@xata.io/client';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { PgDialect } from '../pg-core/index.ts';

export type XataHttpClient = {
	sql: SQLPluginResult;
};

export class XataHttpSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: XataHttpClient,
		dialect: PgDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	async execute() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes, finalMetadata: any | undefined;

		// wrapping xata-http driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const queryResult = await this.client.sql({ statement: query, params, responseType: 'array' });
				({ rows: finalRes, ...finalMetadata } = queryResult);
			} else {
				const queryResult = await this.client.sql({ statement: query, params, responseType: 'json' });
				({ records: finalRes, ...finalMetadata } = queryResult);
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);

		return finalRes as T[];
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once @xata.io/client acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for xata-http yet.');
	}
}
