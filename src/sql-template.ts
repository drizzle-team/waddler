import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from './sql-template-params.ts';

export abstract class SQLTemplate<T> {
	protected abstract strings: readonly string[];
	protected abstract params: any[];

	append(value: SQLTemplate<any>) {
		this.strings = [
			...this.strings.slice(0, -1),
			`${this.strings.at(-1)}${value.strings.at(0)}`,
			...value.strings.slice(1),
		];
		this.params = [...this.params, ...value.params];
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
	toSQL() {
		if (this.params.length === 0) {
			return { query: this.strings[0] ?? '', params: [] };
		}

		const filteredParams: any[] = [];
		// select ${sql.values([['1']])} from ${users}${something}
		// strings=["select ", " from ", '']
		// params=[${sql.values([['1']])}, ${users}, ${something}]

		// chunks=[StringChunk'select '), ${sql.values([['1']])}, StringChunk(" from ")]

		// query = ['']
		// for of chunks
		//    if(chunk is StringChunk) {query.push(chunk.value)}
		// ...
		// query.join('')

		// or

		// query = ''
		// for of chunks
		//    if(chunk is StringChunk) {quer += chunk.generateSQL()}
		// ...
		// return query

		// TODO: params should not be any
		let query = '', param: any;
		for (const [idx, stringI] of this.strings.entries()) {
			if (idx === this.strings.length - 1) {
				query += stringI;
				continue;
			}

			param = this.params[idx];
			let paramPlaceholder: string;
			if (
				param instanceof SQLIdentifier
				|| param instanceof SQLValues
				|| param instanceof SQLRaw
				|| param instanceof SQLDefault
			) {
				const { sql, params } = param.generateSQL(filteredParams.length) as { sql: string; params?: any[] };
				if (params !== undefined) {
					filteredParams.push(...params);
				}
				paramPlaceholder = sql;
				query += stringI + paramPlaceholder;
				continue;
			}

			this.paramsCheck(param);

			filteredParams.push(param);
			// escapeParam
			paramPlaceholder = `$${filteredParams.length}`;
			query += stringI + paramPlaceholder;
		}

		return {
			query,
			params: filteredParams,
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

export abstract class SQLValuesDriver {
	abstract mapToDriver(value: any): any;
}
