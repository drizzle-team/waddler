import type { RowList, Sql } from 'postgres';
import type { PgDialect } from '~/pg-core/dialect.ts';
import type { SQLChunk } from '~/sql-template-params.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { UnsafeParamType } from '../types.ts';

export class PostgresSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected override query: string,
		protected override params: UnsafeParamType[],
		protected readonly client: Sql,
		dialect: PgDialect,
		queryChunks: SQLChunk[],
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(query, params, dialect, queryChunks);

		const transparentParser = (val: any) => val;

		// Override postgres.js default date parsers: https://github.com/porsager/postgres/discussions/761
		for (const type of ['1184', '1082', '1083', '1114']) {
			this.client.options.parsers[type as any] = transparentParser;
			this.client.options.serializers[type as any] = transparentParser;
		}
		this.client.options.serializers['114'] = transparentParser;
		this.client.options.serializers['3802'] = transparentParser;
	}

	async execute() {
		// wrapping postgres-js driver error in new js error to add stack trace to it
		try {
			const query = this.options.rowMode === 'array'
				? this.client.unsafe(this.query, this.params as any[]).values()
				: this.client.unsafe(this.query, this.params as any[]);
			const queryResult = await query;

			// TODO check if cast to unkown is valid
			return queryResult as RowList<T[]> as T[];
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}

	/**
	 * For now, the method executes the query, loads the result into memory, and iterates over it to simulate streaming.
	 * This current implementation (a placeholder) will be replaced once Postgre.js acquires streaming support or when a suitable third-party solution is found.
	 */
	async *stream() {
		// wrapping postgres-js driver error in new js error to add stack trace to it
		try {
			const queryStream = this.client.unsafe(this.query, this.params as any[]);
			for (const row of await queryStream) {
				yield row as T;
			}
		} catch (error) {
			const newError = error instanceof AggregateError
				? new Error(error.errors.map((e) => e.message).join('\n'))
				: new Error((error as Error).message);
			throw newError;
		}
	}
}
