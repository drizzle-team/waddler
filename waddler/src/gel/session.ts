import type { Client } from 'gel';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { GelDialect } from './gel-core/dialect.ts';

export class GelSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Client,
		dialect: GelDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
	}

	async execute() {
		const { query, params } = this.sqlWrapper.getQuery();
		try {
			if (this.options.rowMode === 'array') {
				const rows = await this.client.withSQLRowMode('array').querySQL(query, params.length ? params : undefined);
				return rows as T[];
			}

			const rows = await this.client.querySQL(query, params.length ? params : undefined);
			return rows as T[];
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
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
