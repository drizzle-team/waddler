import type { PGlite, QueryOptions } from '@electric-sql/pglite';
import type { Dialect } from '../../sql-template-params.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { SQLWrapper } from '../../sql.ts';

import { types } from '@electric-sql/pglite';
import { WaddlerQueryError } from '../../errors/index.ts';

export class PGliteSQLTemplate<T> extends SQLTemplate<T> {
	private rawQueryConfig: QueryOptions;
	private queryConfig: QueryOptions;

	constructor(
		override sql: SQLWrapper,
		protected readonly client: PGlite,
		dialect: Dialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);

		this.rawQueryConfig = {
			rowMode: 'object',
			parsers: {
				// [types.TIMESTAMP]: (value) => value,
				// [types.TIMESTAMPTZ]: (value) => value,
				[types.INTERVAL]: (value) => value,
				// [types.DATE]: (value) => value,
			},
		};
		this.queryConfig = {
			rowMode: 'array',
			parsers: {
				// [types.TIMESTAMP]: (value) => value,
				// [types.TIMESTAMPTZ]: (value) => value,
				[types.INTERVAL]: (value) => value,
				// [types.DATE]: (value) => value,
			},
		};
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.query(query, params, this.queryConfig)
				: this.client.query(query, params, this.rawQueryConfig));

			return queryResult.rows as T[];
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once PGlite acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for pglite yet.');
	}
}
