import type { ClickHouseClient } from '@clickhouse/client/';
import type { ClickHouseDialect } from '../clickhouse-core/dialect.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { SQLWrapper } from '../sql.ts';

export class ClickHouseSQLTemplate<T> extends SQLTemplate<T> {
	public returningData: boolean = true;

	constructor(
		override sql: SQLWrapper,
		protected readonly client: ClickHouseClient,
		dialect: ClickHouseDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);
	}

	command(): Omit<ClickHouseSQLTemplate<T>, 'command' | 'query'> {
		this.returningData = false;
		return this;
	}

	query(): Omit<ClickHouseSQLTemplate<T>, 'command' | 'query'> {
		this.returningData = true;
		return this;
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		const queryParams = Object.fromEntries(params);
		try {
			if (this.returningData) {
				const format = this.options.rowMode === 'object' ? 'JSON' : 'JSONCompact';
				const rawRes = await this.client.query({
					query,
					format,
					query_params: queryParams,
				});

				const jsonRes = await rawRes.json();
				return jsonRes.data as T[];
			} else {
				return await this.client.command({
					query,
					query_params: queryParams,
				}) as any;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	async *stream() {
		const { query, params } = this.sql.getQuery();
		const queryParams = Object.fromEntries(params);
		// wrapping clickhouse driver error in new js error to add stack trace to it
		try {
			const format = this.options.rowMode === 'object' ? 'JSONEachRow' : 'JSONCompactEachRow';
			const rawRes = await this.client.query({ query, format, query_params: queryParams });
			const stream = rawRes.stream();

			// size chunk can be set using property `max_block_size` in clickhouse_settings
			for await (const chunk of stream) {
				for (const row of chunk) {
					yield await row.json() as T;
				}
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
