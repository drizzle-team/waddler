import type { Client } from 'gel';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../sql-template.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { GelDialect } from './gel-core/dialect.ts';

export class GelSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Client,
		dialect: GelDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	async execute() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let rows;

		try {
			rows = await (this.options.rowMode === 'array'
				? this.client.withSQLRowMode('array').querySQL(query, params.length ? params : undefined)
				: this.client.querySQL(query, params.length ? params : undefined));
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params);
		return rows as T[];
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once gel acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		throw new Error('stream is not implemented for gel yet.');
	}
}
