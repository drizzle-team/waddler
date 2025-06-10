import { Dialect, SQLDefault } from '../../sql-template-params.ts';
import type { IdentifierObject, Value } from '../../types.ts';
import type { GelSQLTemplate } from '../session.ts';

export class GelDialect extends Dialect {
	escapeParam(lastParamIdx: number): string {
		return `$${lastParamIdx}`;
	}

	escapeIdentifier(identifier: string): string {
		return `"${identifier}"`;
	}

	checkIdentifierObject(object: IdentifierObject) {
		if (Object.values(object).includes(undefined!)) {
			throw new Error(
				`you can't specify undefined parameters. maybe you want to omit it?`,
			);
		}

		if (Object.keys(object).length === 0) {
			throw new Error(`you need to specify at least one parameter.`);
		}

		if (
			object.schema !== undefined
			&& object.table === undefined
			&& object.column !== undefined
		) {
			throw new Error(
				`you can't specify only "schema" and "column" properties, you need also specify "table".`,
			);
		}

		if (Object.keys(object).length === 1 && object.as !== undefined) {
			throw new Error(`you can't specify only "as" property.`);
		}

		if (
			object.as !== undefined
			&& object.column === undefined
			&& object.table === undefined
		) {
			throw new Error(
				`you have to specify "column" or "table" property along with "as".`,
			);
		}

		if (
			!['string', 'undefined'].includes(typeof object.schema)
			|| !['string', 'undefined'].includes(typeof object.table)
			|| !['string', 'undefined'].includes(typeof object.column)
			|| !['string', 'undefined'].includes(typeof object.as)
		) {
			throw new Error(
				"object properties 'schema', 'table', 'column', 'as' should be of string type or omitted.",
			);
		}
	}

	// SQLValues
	valueToSQL(
		{ value, lastParamIdx, params }: {
			value: Value;
			lastParamIdx: number;
			params: Value[];
		},
	): string {
		if (value instanceof SQLDefault) {
			return value.generateSQL().sql;
		}

		if (value === undefined) {
			throw new Error("value can't be undefined, maybe you mean sql.default?");
		}

		params.push(value);
		return this.escapeParam(lastParamIdx + params.length);
	}
}

export class UnsafePromise<
	T,
	DriverT extends GelSQLTemplate<T>,
> {
	constructor(public driver: DriverT) {}

	query(): Omit<UnsafePromise<T, DriverT>, 'query' | 'querySQL'> {
		this.driver.query();
		return this;
	}

	querySQL(): Omit<UnsafePromise<T, DriverT>, 'query' | 'querySQL'> {
		this.driver.querySQL();
		return this;
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
		const result = this.driver.execute();
		return Promise.resolve(result).then(onfulfilled, onrejected);
	}
}
