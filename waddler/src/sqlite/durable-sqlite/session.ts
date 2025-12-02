/// <reference types="@cloudflare/workers-types" />

import type { SQLWrapper } from '~/sql.ts';
import type { SqliteDialect } from '~/sqlite/sqlite-core/dialect.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class DurableSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: DurableObjectStorage,
		dialect: SqliteDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	all(): Omit<DurableSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = true;
		return this;
	}

	run(): Omit<DurableSqliteSQLTemplate<T>, 'all' | 'run'> {
		this.returningData = false;
		return this;
	}

	async execute() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes, finalMetadata: any | undefined;

		// wrapping durable-sqlite driver error in new js error to add stack trace to it
		try {
			if (this.returningData) {
				if (this.options.rowMode === 'array') {
					const res = params.length > 0
						? this.client.sql.exec(query, ...params)
						: this.client.sql.exec(query);

					finalMetadata = { columnNames: res.columnNames, rowsRead: res.rowsRead, rowsWritten: res.rowsWritten };
					// @ts-ignore .raw().toArray() exists
					finalRes = res.raw().toArray();
				} else {
					const res = params.length > 0
						? this.client.sql.exec(query, ...params)
						: this.client.sql.exec(query);

					finalMetadata = { columnNames: res.columnNames, rowsRead: res.rowsRead, rowsWritten: res.rowsWritten };
					finalRes = res.toArray();
				}
			} else {
				const res = params.length > 0 ? this.client.sql.exec(query, ...params) : this.client.sql.exec(query);
				finalMetadata = { columnNames: res.columnNames, rowsRead: res.rowsRead, rowsWritten: res.rowsWritten };
				finalRes = res;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);

		return finalRes as T[];
	}

	async *stream() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);

		// wrapping durable-sqlite driver error in new js error to add stack trace to it
		try {
			if (this.options.rowMode === 'array') {
				const res = params.length > 0
					? this.client.sql.exec(query, ...params)
					: this.client.sql.exec(query);

				// @ts-ignore .raw().toArray() exists
				const stream = res.raw();
				for await (const row of stream) {
					yield row as T;
				}
				return;
			}

			const stream = params.length > 0
				? this.client.sql.exec(query, ...params)
				: this.client.sql.exec(query);

			for await (const row of stream) {
				yield row as T;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
