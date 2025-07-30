/// <reference types="@cloudflare/workers-types" />

import type { SQLWrapper } from '~/sql.ts';
import type { SqliteDialect } from '~/sqlite/sqlite-core/dialect.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import { SQLTemplate } from '../../sql-template.ts';

export class DurableSqliteSQLTemplate<T> extends SQLTemplate<T> {
	private returningData: boolean = true;

	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: DurableObjectStorage,
		dialect: SqliteDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect);
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
		const { query, params } = this.sqlWrapper.getQuery();

		// wrapping durable-sqlite driver error in new js error to add stack trace to it
		try {
			if (this.returningData) {
				if (this.options.rowMode === 'array') {
					const res = params.length > 0
						? this.client.sql.exec(query, ...params)
						: this.client.sql.exec(query);

					// @ts-ignore .raw().toArray() exists
					return res.raw().toArray();
				}

				return params.length > 0
					? this.client.sql.exec(query, ...params).toArray() as T[]
					: this.client.sql.exec(query).toArray() as T[];
			} else {
				return params.length > 0 ? this.client.sql.exec(query, ...params) : this.client.sql.exec(query);
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}

	async *stream() {
		const { query, params } = this.sqlWrapper.getQuery();

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
