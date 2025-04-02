import { WaddlerConfig } from './extensions.ts';
import type { Dialect } from './sql-template-params.ts';
import {
	SQLChunk,
	SQLCommonParam,
	SQLDefault,
	SQLIdentifier,
	SQLRaw,
	SQLString,
	SQLValues,
} from './sql-template-params.ts';
import { Query, SQLWrapper } from './sql.ts';
import type { JSONArray, JSONObject } from './types.ts';

type ParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONArray
	| JSONObject
	| SQLDefault
	| SQLIdentifier<any>
	| SQLRaw
	| SQLValues<any>;

export abstract class SQLTemplate<T> {
	protected queryChunks: SQLChunk[] = [];

	constructor(
		protected query: string,
		protected params: ParamType[],
		protected configOptions?: WaddlerConfig,
	) {
	}

	append(value: SQLTemplate<T>) {
		const thisLastChunk = this.queryChunks.at(-1), valueFirstChunk = value.queryChunks.at(0);
		if (thisLastChunk instanceof SQLString && valueFirstChunk instanceof SQLString) {
			const middleChunk = new SQLString(
				`${thisLastChunk.generateSQL().sql}${valueFirstChunk.generateSQL().sql}`,
			);
			this.queryChunks = [...this.queryChunks.slice(0, -1), middleChunk, ...value.queryChunks.slice(1)];
			return;
		}
		this.queryChunks = [...this.queryChunks, ...value.queryChunks];
	}

	toSQL(): Query {
		return { query: this.query, params: this.params };
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

export abstract class SQLDriver {
	abstract mapToDriver(value: any): any;
}
