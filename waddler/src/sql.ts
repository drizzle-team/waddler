import type { ClickHouseDialect } from './clickhouse-core/dialect.ts';
import type { Dialect } from './sql-template-params.ts';
import {
	SQLChunk,
	SQLCommonParam,
	SQLDefault,
	SQLIdentifier,
	SQLQuery,
	SQLRaw,
	SQLString,
	SQLValues,
} from './sql-template-params.ts';
import { SQLTemplate } from './sql-template.ts';
import type {
	Identifier,
	IdentifierObject,
	IsEqual,
	Raw,
	RowData,
	SQLParamType,
	UnsafeParamType,
	Value,
	Values,
} from './types.ts';

export interface Query<ParamsType extends 'array' | 'object' = 'array'> {
	sql: string;
	// TODO: revise: params should have types that are suitable for specific driver therefore can differ. example: pg driver and sqlite driver(can't accept Date value)
	// for now I should leave params as they are until I add more descriptve errors in the types
	params: ParamsType extends 'array' ? Value[] : Record<string, Value>;
}

export interface BuildQueryConfig {
	escapeIdentifier(identifier: string): string;
	escapeParam(lastParamIdx: number, typeToCast: string): string;
	createEmptyParams(): any[] | Record<string, any>;
	pushParams(
		params: any[] | Record<string, any>,
		param: any[] | Record<string, any>,
		lastParamIdx: number,
		mode: 'bulk' | 'single',
	): void;
	checkIdentifierObject(object: IdentifierObject): void;
	valueToSQL(
		{ value, lastParamIdx, params }: {
			value: Value;
			lastParamIdx: number;
			params: UnsafeParamType[] | Record<string, UnsafeParamType>;
			types: string[];
			colIdx: number;
			paramsCount: number;
		},
	): string;
}

export interface SQL {
	<T = RowData>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): SQLTemplate<T>;
	identifier(value: Identifier<IdentifierObject>): SQLIdentifier<IdentifierObject>;
	values(value: Values): SQLValues;
	raw(value: Raw): SQLRaw;
	unsafe<RowMode extends 'array' | 'object'>(
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
		public sql?: string,
		public params?: UnsafeParamType[] | Record<string, UnsafeParamType>,
	) {}

	with({ templateParams, rawParams }: {
		templateParams?: { strings?: TemplateStringsArray; params: SQLParamType[] };
		rawParams?: { sql: string; params: UnsafeParamType[] | Record<string, UnsafeParamType> };
	}): this {
		if (templateParams) {
			const { strings, params } = templateParams;
			if (strings === undefined) return this;

			if (params.length > 0 || (strings.length > 0 && strings[0] !== '')) {
				this.queryChunks.push(new SQLString(strings[0]!));
			}
			for (const [paramIndex, param] of params.entries()) {
				if (param instanceof SQLQuery || param instanceof SQLTemplate) {
					this.append(param.sqlWrapper);
					this.queryChunks.push(new SQLString(strings[paramIndex + 1]!));
				} else if (param instanceof SQLChunk) this.queryChunks.push(param, new SQLString(strings[paramIndex + 1]!));
				else {
					paramsCheck(param);
					this.queryChunks.push(new SQLCommonParam(param), new SQLString(strings[paramIndex + 1]!));
				}
			}
		} else if (rawParams) {
			this.sql = rawParams.sql;
			this.params = rawParams.params;
		}
		return this;
	}

	getQuery<
		DialectT extends Dialect,
		ParamsType extends 'array' | 'object' = IsEqual<DialectT, ClickHouseDialect> extends true ? 'object' : 'array',
	>(dialect: DialectT): Query<ParamsType> {
		return {
			sql: this.sql ?? '',
			params: this.params as Query<ParamsType>['params'] ?? dialect.createEmptyParams() as Query<ParamsType>['params'],
		};
	}

	// This alias is provided to improve clarity when recalculating queries for functions such as "append."
	recalculateQuery(dialect: Dialect): this {
		return this.prepareQuery(dialect);
	}

	prepareQuery(dialect: Dialect): this {
		if (this.queryChunks.length === 1 && this.queryChunks[0] instanceof SQLString) {
			this.sql = this.queryChunks[0].generateSQL().sql;
			this.params = dialect.createEmptyParams();
		}

		const params4driver: UnsafeParamType[] | Record<string, UnsafeParamType> = dialect.createEmptyParams();
		let paramsCount = 0;
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
				query += chunk.generateSQL({ dialect }).sql;
			}

			if (chunk instanceof SQLValues || chunk instanceof SQLCommonParam) {
				const { sql, params, paramsCount: newParamsCount } = chunk.generateSQL({ dialect, lastParamIdx: paramsCount });
				query += sql;
				dialect.pushParams(params4driver, params, paramsCount + 1, 'bulk');
				paramsCount += newParamsCount;
				// params4driver.push(...params);
			}
		}

		this.sql = query;
		this.params = params4driver;

		return this;
	}

	append(other: SQLWrapper) {
		const thisLastChunk = this.queryChunks.at(-1), otherFirstChunk = other.queryChunks.at(0);
		if (thisLastChunk instanceof SQLString && otherFirstChunk instanceof SQLString) {
			const middleChunk = new SQLString(
				`${thisLastChunk.generateSQL().sql}${otherFirstChunk.generateSQL().sql}`,
			);
			this.queryChunks = [
				...this.queryChunks.slice(0, -1),
				middleChunk,
				...other.queryChunks.slice(1),
			];
			return;
		}
		this.queryChunks.push(...other.queryChunks);

		// should accept queryChunks that will be recalculated, I'll leave it as mutating object for now,
		// but I don't want to do it this way
		// this.recalculateQuery(this.dialect);
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
