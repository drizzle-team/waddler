import type { Client, Connection } from '@planetscale/database';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { MySQLDialect } from '../mysql-core/dialect.ts';

export class PlanetscaleServerlessSQLTemplate<T> extends SQLTemplate<T> {
	private rawQueryConfig = { as: 'object' } as const;
	private queryConfig = { as: 'array' } as const;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Client | Connection, // TODO should I include Transaction here?
		dialect: MySQLDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
	}

	async execute() {
		const { query, params } = this.sqlWrapper.getQuery(this.dialect);
		try {
			if (this.options.rowMode === 'array') {
				const { rows } = await this.client.execute(query, params, this.queryConfig);
				return rows as T[];
			}

			const res = await this.client.execute(query, params, this.rawQueryConfig);
			return res.rows as T[];
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	/**
	 * For now, throws the Error.
	 * Current implementation (a placeholder) will be replaced once planetscale-serverless driver acquires streaming support or when a suitable third-party solution is found.
	 */
	// eslint-disable-next-line require-yield
	async *stream() {
		// TODO not implemented yet
		throw new Error('stream is not implemented for planetscale-serverless yet.');
	}
}
