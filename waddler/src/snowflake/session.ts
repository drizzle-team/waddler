import type { Connection, RowMode, RowStatement, StatementCallback } from 'snowflake-sdk';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../errors/index.ts';
import type { SnowflakeDialect } from '../snowflake-core/dialect.ts';
import type { SQLTemplateConfigOptions } from '../sql-template.ts';
import { SQLTemplate } from '../sql-template.ts';

const noopStatementCallback: StatementCallback = () => {};
const isRowStatement = (statement: unknown): statement is RowStatement => {
	if (typeof statement !== 'object' || statement === null) return false;

	const candidate = statement as Partial<RowStatement>;
	return typeof candidate.getQueryId === 'function'
		&& typeof candidate.getNumRows === 'function'
		&& typeof candidate.getNumUpdatedRows === 'function'
		&& typeof candidate.streamRows === 'function'
		&& typeof candidate.cancel === 'function';
};

export class SnowflakeSQLTemplate<T> extends SQLTemplate<T, SnowflakeDialect> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: Connection,
		override dialect: SnowflakeDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
		private ensureConnected_: () => Promise<void> = async () => {},
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	private async ensureConnected() {
		await this.ensureConnected_();
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

						if (!isRowStatement(stmt)) {
							reject(new Error('Snowflake execute callback did not provide a statement'));
							return;
						}

						try {
							finalMetadata = {
								queryId: stmt.getQueryId(),
								numRows: stmt.getNumRows(),
								numUpdatedRows: stmt.getNumUpdatedRows(),
							};

							resolve((rows ?? []) as T[]);
						} catch (error) {
							reject(error);
						}
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

						if (!isRowStatement(stmt)) {
							reject(new Error('Snowflake stream callback did not provide a statement'));
							return;
						}

						resolve(stmt);
					},
				});
			});
		} catch (error) {
			throw new WaddlerQueryError(query, params, error as Error);
		}

		try {
			this.logger.logQuery(query, params);

			const stream = statement.streamRows();
			let consumedFully = false;

			try {
				for await (const row of stream) {
					yield row as Awaited<T>;
				}

				consumedFully = true;
			} finally {
				if (!consumedFully) {
					try {
						stream.destroy?.();
					} catch {
						// Ignore cleanup failures when the consumer stops early.
					}

					try {
						statement.cancel(noopStatementCallback);
					} catch {
						// Ignore cancellation failures when the consumer stops early.
					}
				}
			}
		} catch (error) {
			try {
				statement.cancel(noopStatementCallback);
			} catch {
				// Ignore cancellation failures while surfacing the original error.
			}

			throw new WaddlerQueryError(query, params, error as Error);
		}
	}
}
