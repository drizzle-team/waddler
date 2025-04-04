import type { Identifier, Raw } from './sql-template-params.ts';
import {
	SQLChunk,
	SQLCommonParam,
	SQLDefault,
	SQLIdentifier,
	SQLRaw,
	SQLString,
	SQLValues,
} from './sql-template-params.ts';
import type { SQLTemplate } from './sql-template.ts';
import type { JSONArray, JSONObject, RowData, SQLParamType, UnsafeParamType } from './types.ts';

export type IdentifierObject = {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
};

export type Value =
	| string
	| number
	| bigint
	| boolean
	| Date
	| SQLDefault
	| null
	| JSONObject
	| JSONArray
	| Value[];

export type Values = Value[][];

export interface Query {
	query: string;
	// TODO: revise: params should have types that are suitable for specific driver therefore can differ. example: pg driver and sqlite driver(can't accept Date value)
	params: UnsafeParamType[];
}

export interface BuildQueryConfig {
	escapeIdentifier(identifier: string): string;
	escapeParam(lastParamIdx: number): string;
	checkIdentifierObject(object: IdentifierObject): void;
	valueToSQL<Value>(
		{ value, lastParamIdx, params }: {
			value: Value;
			lastParamIdx: number;
			params: Value[];
		},
	): string;
}

export interface SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: SQLParamType[]): SQLTemplate<T>;
	identifier(value: Identifier<IdentifierObject>): SQLIdentifier<IdentifierObject>;
	values(value: Values): SQLValues<Values>;
	raw(value: Raw): SQLRaw;
	unsafe<RowMode extends 'array' | 'object' = 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): Promise<
		RowMode extends 'array' ? any[][] : {
			[columnName: string]: any;
		}[]
	>;
	default: SQLDefault;
}

export class SQLWrapper {
	constructor(
		public queryChunks: SQLChunk[] = [],
		public query?: string,
		public params?: UnsafeParamType[],
	) {}

	with({ templateParams, rawParams }: {
		templateParams?: { strings?: TemplateStringsArray; params: SQLParamType[] };
		rawParams?: { query: string; params: UnsafeParamType[] };
	}): this {
		if (templateParams) {
			const { strings, params } = templateParams;
			if (strings === undefined) return this;

			if (params.length > 0 || (strings.length > 0 && strings[0] !== '')) {
				this.queryChunks.push(new SQLString(strings[0]!));
			}
			for (const [paramIndex, param] of params.entries()) {
				if (param instanceof SQLChunk) this.queryChunks.push(param, new SQLString(strings[paramIndex + 1]!));
				else {
					paramsCheck(param);
					this.queryChunks.push(new SQLCommonParam(param), new SQLString(strings[paramIndex + 1]!));
				}
			}
		} else if (rawParams) {
			this.query = rawParams.query;
			this.params = rawParams.params;
		}
		return this;
	}

	getQuery(): Query {
		return {
			query: this.query ?? '',
			params: this.params ?? [],
		};
	}

	// This alias is provided to improve clarity when recalculating queries for functions such as "append."
	recalculateQuery(config: BuildQueryConfig): this {
		return this.prepareQuery(config);
	}

	prepareQuery(config: BuildQueryConfig): this {
		if (this.queryChunks.length === 1 && this.queryChunks[0] instanceof SQLString) {
			this.query = this.queryChunks[0].generateSQL().sql;
			this.params = [];
		}

		// TODO: params should not be any
		const params4driver: UnsafeParamType[] = [];
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
				query += chunk.generateSQL({ dialect: config }).sql;
			}

			if (chunk instanceof SQLValues || chunk instanceof SQLCommonParam) {
				const { sql, params } = chunk.generateSQL({ dialect: config, lastParamIdx: params4driver.length });
				query += sql;
				params4driver.push(...params);
			}
		}

		this.query = query;
		this.params = params4driver;

		return this;
	}
}

export function paramsCheck(param: SQLParamType) {
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
