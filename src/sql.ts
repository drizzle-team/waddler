import { SQLTemplate } from './sql-template';
import {
	Identifier,
	Raw,
	SQLChunk,
	SQLCommonParam,
	SQLDefault,
	SQLIdentifier,
	SQLRaw,
	SQLString,
	SQLValues,
} from './sql-template-params';
import { JSONArray, JSONObject, RowData, SQLParamType, UnsafeParamType } from './types';

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
	params: SQLParamType[];
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
	private queryChunks: SQLChunk[] = [];
	constructor(strings: TemplateStringsArray, ...params: SQLParamType[]) {
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
	}

	toSQL(config: BuildQueryConfig): Query {
		if (this.queryChunks.length === 1 && this.queryChunks[0] instanceof SQLString) {
			return { query: this.queryChunks[0].generateSQL().sql, params: [] };
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

		return {
			query,
			params: params4driver,
		};
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
