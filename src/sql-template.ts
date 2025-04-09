import type { WaddlerConfig } from './extensions.ts';
import type { Dialect } from './sql-template-params.ts';
import { SQLString } from './sql-template-params.ts';
import type { Query, SQLWrapper } from './sql.ts';

export abstract class SQLTemplate<T> {
	constructor(
		protected sql: SQLWrapper,
		protected dialect: Dialect,
		protected configOptions?: WaddlerConfig,
	) {}

	append(value: SQLTemplate<T>) {
		const thisLastChunk = this.sql.queryChunks.at(-1), valueFirstChunk = value.sql.queryChunks.at(0);
		if (thisLastChunk instanceof SQLString && valueFirstChunk instanceof SQLString) {
			const middleChunk = new SQLString(
				`${thisLastChunk.generateSQL().sql}${valueFirstChunk.generateSQL().sql}`,
			);
			this.sql.queryChunks = [...this.sql.queryChunks.slice(0, -1), middleChunk, ...value.sql.queryChunks.slice(1)];
			this.sql.recalculateQuery(this.dialect);
			return;
		}
		this.sql.queryChunks = [...this.sql.queryChunks, ...value.sql.queryChunks];

		// should accept queryChunks that will be recalculated, I'll leave it as mutating object for now,
		// but I don't want to do it this way
		this.sql.recalculateQuery(this.dialect);
	}

	toSQL(): Query {
		return this.sql.getQuery();
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
