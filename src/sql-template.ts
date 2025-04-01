import { WaddlerConfig } from './extensions.ts';
import type { Dialect } from './sql-template-params.ts';
import {
	SQLCommonParam,
	SQLDefault,
	SQLIdentifier,
	SQLParam,
	SQLRaw,
	SQLString,
	SQLValues,
} from './sql-template-params.ts';
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

export abstract class SQLTemplate<T, RawParam> {
	protected queryChunks: SQLParam[];

	constructor(
		strings: readonly string[],
		params: ParamType[],
		protected readonly dialect: Dialect,
		protected configOptions: WaddlerConfig,
	) {
		this.queryChunks = [];
		if (params.length > 0 || (strings.length > 0 && strings[0] !== '')) {
			this.queryChunks.push(new SQLString(strings[0]!));
		}
		for (const [paramIndex, param] of params.entries()) {
			if (param instanceof SQLParam) this.queryChunks.push(param, new SQLString(strings[paramIndex + 1]!));
			else {
				this.paramsCheck(param);
				this.queryChunks.push(new SQLCommonParam(param), new SQLString(strings[paramIndex + 1]!));
			}
		}
	}

	append(value: SQLTemplate<T, RawParam>) {
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

	paramsCheck(param: any) {
		if (param === undefined) {
			throw new Error("you can't specify undefined as parameter");
		}

		if (typeof param === 'symbol') {
			throw new Error("you can't specify symbol as parameter");
		}

		if (typeof param === 'function') {
			throw new Error("you can't specify function as parameter");
		}
	}

	// Method to extract raw SQL
	toSQL(): {
		query: string;
		params: RawParam[];
	} {
		if (this.queryChunks.length === 1 && this.queryChunks[0] instanceof SQLString) {
			return { query: this.queryChunks[0].generateSQL().sql, params: [] };
		}

		// TODO: params should not be any
		const params4driver: RawParam[] = [];
		let query = '';

		for (const chunk of this.queryChunks) {
			if (
				chunk instanceof SQLString
				|| chunk instanceof SQLRaw
				|| chunk instanceof SQLDefault
			) {
				query += chunk.generateSQL().sql;
			}

			if (chunk instanceof SQLIdentifier) {
				query += chunk.generateSQL({ dialect: this.dialect }).sql;
			}

			if (chunk instanceof SQLValues || chunk instanceof SQLCommonParam) {
				const { sql, params } = chunk.generateSQL({ dialect: this.dialect, lastParamIdx: params4driver.length });
				query += sql;
				params4driver.push(...params);
			}
		}

		return {
			query,
			params: params4driver,
		};
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
		const result = this.executeQuery();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}

	protected abstract executeQuery(): Promise<T[]>;

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
