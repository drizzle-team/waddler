import type { ConnectionPool, Request } from 'mssql';
import type { SQLWrapper } from '~/sql.ts';
import { WaddlerQueryError } from '../../errors/index.ts';
import type { SQLTemplateConfigOptions } from '../../sql-template.ts';
import { SQLTemplate } from '../../sql-template.ts';
import type { MsSqlDialect } from '../mssql-core/dialect.ts';
import { AutoPool } from './pool.ts';

export type NodeMsSqlClient = Pick<ConnectionPool, 'request'> | AutoPool;

export class NodeMsSqlSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		override sqlWrapper: SQLWrapper,
		protected readonly client: NodeMsSqlClient,
		dialect: MsSqlDialect,
		configOptions: SQLTemplateConfigOptions,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sqlWrapper, dialect, configOptions);
	}

	async execute() {
		const { params, sql } = this.sqlWrapper.getQuery(this.dialect);
		let finalResult;
		let finalMetadata: any | undefined;

		let queryClient = this.client as ConnectionPool;
		if (this.client instanceof AutoPool) {
			queryClient = await this.client.$instance();
		}

		const request = queryClient.request() as Request & { arrayRowMode: boolean };
		for (const [index, param] of params.entries()) {
			request.input(this.dialect.escapeParam(index + 1), param);
		}

		if (this.options.rowMode === 'array') request.arrayRowMode = true;

		try {
			const queryResult = await request.query(sql);

			finalResult = queryResult.recordset;
			// finalMetadata = queryResult[1];
		} catch (error) {
			throw new WaddlerQueryError(sql, params, error as Error);
		}

		this.logger.logQuery(sql, params, finalMetadata);
		return finalResult as T[];
	}

	async *stream() {
		const { sql, params } = this.sqlWrapper.getQuery(this.dialect);

		let queryClient = this.client as ConnectionPool;
		if (this.client instanceof AutoPool) {
			queryClient = await this.client.$instance();
		}

		const request = queryClient.request() as Request & { arrayRowMode: boolean };
		request.stream = true;
		if (this.options.rowMode === 'array') request.arrayRowMode = true;

		for (const [index, param] of params.entries()) {
			request.input(this.dialect.escapeParam(index + 1), param);
		}

		// wrapping mysql2 driver error in new js error to add stack trace to it
		try {
			const stream = request.toReadableStream();

			request.query(sql);

			for await (const row of stream) {
				yield row;
			}
		} catch (error) {
			throw new WaddlerQueryError(sql, params, error as Error);
		} finally {
			request.cancel();
		}
	}
}
