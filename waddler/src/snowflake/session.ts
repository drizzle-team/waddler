import type { Connection, RowMode, RowStatement } from 'snowflake-sdk';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import type { SnowflakeDialect } from '../snowflake-core/dialect.ts';
import type { SQLTemplateConfigOptions } from '../sql-template.ts';
import { SQLTemplate } from '../sql-template.ts';

export class SnowflakeSQLTemplate<T> extends SQLTemplate<T, SnowflakeDialect> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Connection,
		override dialect: SnowflakeDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	private async ensureConnected() {
		if (this.client.isUp()) return;

		await new Promise<void>((resolve, reject) => {
			this.client.connect((err) => {
				if (err) {
					reject(err);
					return;
				}

				resolve();
			});
		});
	}

	async execute() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let finalRes: T[];
		let finalMetadata: any;

		try {
			await this.ensureConnected();

			finalRes = await new Promise<T[]>((resolve, reject) => {
				this.client.execute({
					sqlText: query,
					binds: params as any,
					rowMode: this.options.rowMode as RowMode,
					complete: (err, stmt, rows) => {
						if (err) {
							reject(err);
							return;
						}

						finalMetadata = {
							queryId: stmt.getQueryId(),
							numRows: stmt.getNumRows(),
							numUpdatedRows: stmt.getNumUpdatedRows(),
						};

						resolve((rows ?? []) as T[]);
					},
				});
			});
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, finalMetadata);
		return finalRes;
	}

	async *stream() {
		const { sql: query, params } = this.sqlWrapper.getQuery(this.dialect);
		let statement: RowStatement;

		try {
			await this.ensureConnected();

			statement = await new Promise<RowStatement>((resolve, reject) => {
				this.client.execute({
					sqlText: query,
					binds: params as any,
					rowMode: this.options.rowMode as RowMode,
					streamResult: true,
					complete: (err, stmt) => {
						if (err) {
							reject(err);
							return;
						}

						resolve(stmt as RowStatement);
					},
				});
			});
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		this.logger.logQuery(query, params, {
			queryId: statement.getQueryId(),
			numRows: statement.getNumRows(),
			numUpdatedRows: statement.getNumUpdatedRows(),
		});

		const stream = statement.streamRows();

		try {
			for await (const row of stream) {
				yield row as Awaited<T>;
			}
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
