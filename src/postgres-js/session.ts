import type { RowList, Sql } from 'postgres';
import type { PgDialect } from '~/pg-core/dialect.ts';
import { SQLTemplate } from '../sql-template.ts';
import type { SQLWrapper } from '../sql.ts';

export class PostgresSQLTemplate<T> extends SQLTemplate<T> {
	constructor(
		protected override sql: SQLWrapper,
		protected readonly client: Sql,
		dialect: PgDialect,
		private options: { rowMode: 'array' | 'object' } = { rowMode: 'object' },
	) {
		super(sql, dialect);

		// const transparentParser = (val: any) => val;

		// Override postgres.js default date parsers: https://github.com/porsager/postgres/discussions/761
		// TODO: revise: why do we need to override these types?
		// for (const type of ['1184', '1082', '1083', '1114']) {
		// 	this.client.options.parsers[type as any] = transparentParser;
		// 	this.client.options.serializers[type as any] = transparentParser;
		// }
		// this.client.options.serializers['114'] = transparentParser;
		// this.client.options.serializers['3802'] = transparentParser;

		// // TODO: revise: somehow it doesn't have any effect on _bool type (bool[])
		this.client.options.serializers['1000'] = (val: boolean[]) =>
			JSON.stringify(val).replaceAll('[', '{').replaceAll(']', '}');
		this.client.options.parsers['1000'] = (val: string) => JSON.parse(val.replaceAll('{', '[').replaceAll('}', ']'));
	}

	async execute() {
		const { query, params } = this.sql.getQuery();
		// wrapping postgres-js driver error in new js error to add stack trace to it
		try {
			const queryResult = await (this.options.rowMode === 'array'
				? this.client.unsafe(query, params as any[]).values()
				: this.client.unsafe(query, params as any[]));

			// TODO check if cast to RowList<T[]> is valid
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
		const { query, params } = this.sql.getQuery();
		// wrapping postgres-js driver error in new js error to add stack trace to it
		try {
			const queryStream = this.client.unsafe(query, params as any[]);
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
