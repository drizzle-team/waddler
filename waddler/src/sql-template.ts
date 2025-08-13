import type { WaddlerDriverExtension } from './extensions/index.ts';
import { type Logger, NoopLogger } from './logger.ts';
import type { Dialect, SQLQuery } from './sql-template-params.ts';
import type { SQLWrapper } from './sql.ts';

export type SQLTemplateConfigOptions = {
	extensions?: WaddlerDriverExtension[];
	logger?: Logger;
};
export abstract class SQLTemplate<T, DialectT extends Dialect = Dialect> {
	protected logger: Logger;
	constructor(
		public sqlWrapper: SQLWrapper,
		public dialect: DialectT,
		public configOptions: SQLTemplateConfigOptions = {},
	) {
		this.logger = configOptions.logger ?? new NoopLogger();
	}

	append(other: SQLTemplate<T, DialectT> | SQLQuery<DialectT>) {
		this.sqlWrapper.append(other.sqlWrapper);
		this.sqlWrapper.recalculateQuery(this.dialect);
	}

	toSQL() {
		return this.sqlWrapper.getQuery<DialectT>(this.dialect);
	}

	// Allow it to be awaited (like a Promise)
	then<TResult1 = T[], TResult2 = never>(
		onfulfilled?:
			| ((value: T[]) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined,
	): Promise<TResult1 | TResult2> {
		// Here you could handle the query execution logic (replace with your own)
		const result = this.execute();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}

	abstract execute(): Promise<T[]>;

	abstract stream(): AsyncGenerator<Awaited<T>, void, unknown>;

	async *chunked(chunkSize: number = 1) {
		let rows: T[] = [];
		let row: T;
		const asyncIterator = this.stream();
		let iterResult = await asyncIterator.next();

		while (!iterResult.done) {
			row = iterResult.value as T;
			rows.push(row);

			if (rows.length % chunkSize === 0) {
				yield rows;
				rows = [];
			}

			iterResult = await asyncIterator.next();
		}

		if (rows.length !== 0) {
			yield rows;
		}
	}
}
