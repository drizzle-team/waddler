import type { WaddlerConfig } from './extensions/index.ts';
import type { Dialect, SQLQuery } from './sql-template-params.ts';
import type { Query, SQLWrapper } from './sql.ts';

export abstract class SQLTemplate<T> {
	constructor(
		public sqlWrapper: SQLWrapper,
		public dialect: Dialect,
		public configOptions?: WaddlerConfig,
	) {}

	append(other: SQLTemplate<T> | SQLQuery) {
		this.sqlWrapper.append(other.sqlWrapper);
		this.sqlWrapper.recalculateQuery(this.dialect);
	}

	toSQL(): Query {
		return this.sqlWrapper.getQuery();
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
