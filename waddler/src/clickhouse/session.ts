import type { ClickHouseClient, CommandResult } from '@clickhouse/client/';
import type { ClickHouseDialect } from '../clickhouse-core/dialect.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../sql-template.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { SQLWrapper } from '../sql.ts';

export class ClickHouseSQLTemplate<T> extends SQLTemplate<T, ClickHouseDialect> {
	public returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: ClickHouseClient,
		override dialect: ClickHouseDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
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
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes: T[];
		let finalMetadata: any | undefined;

		try {
			if (this.returningData) {
				const format = this.options.rowMode === 'object' ? 'JSON' : 'JSONCompact';
				const rawRes = await this.client.query({
					query,
					format,
					query_params: params,
				});

				const jsonRes = await rawRes.json();

				const { data, ...metadata } = jsonRes;

				finalRes = data as T[];
				finalMetadata = metadata;
			} else {
				const rawRes: CommandResult = await this.client.command({
					query,
					query_params: params,
				});

				finalRes = rawRes as any;
				finalMetadata = rawRes;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, JSON.stringify(params), error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);
		return finalRes;
	}

	async *stream() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);

		// wrapping clickhouse driver error in new js error to add stack trace to it
		try {
			const format = this.options.rowMode === 'object' ? 'JSONEachRow' : 'JSONCompactEachRow';
			const rawRes = await this.client.query({ query, format, query_params: params });
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
