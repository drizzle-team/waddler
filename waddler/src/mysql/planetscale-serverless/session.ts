import type { Client, Connection } from '@planetscale/database';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { MySQLDialect } from '../mysql-core/dialect.ts';

export class PlanetscaleServerlessSQLTemplate<T> extends SQLTemplate<T> {
	private rawQueryConfig = { as: 'object' } as const;
	private queryConfig = { as: 'array' } as const;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Client | Connection, // TODO should I include Transaction here?
		dialect: MySQLDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	async execute() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes;
		let finalMetadata: any | undefined;

		try {
			const rawRes = await ((this.options.rowMode === 'array')
				? this.client.execute(query, params, this.queryConfig)
				: this.client.execute(query, params, this.rawQueryConfig));

			({ rows: finalRes, ...finalMetadata } = rawRes);
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);
		return finalRes as T[];
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
