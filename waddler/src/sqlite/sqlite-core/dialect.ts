import type { BetterSqlite3SQLTemplate } from '~/sqlite/better-sqlite3/session.ts';
import type { BunSqliteSQLTemplate } from '~/sqlite/bun-sqlite/session.ts';
import type { D1SQLTemplate } from '~/sqlite/d1/session.ts';
import type { DurableSqliteSQLTemplate } from '~/sqlite/durable-sqlite/session.ts';
import type { LibsqlSQLTemplate } from '~/sqlite/libsql/session.ts';
import { Dialect, SQLDefault } from '../../sql-template-params.ts';
import type { Value } from '../../types.ts';
import type { ExpoSqliteSQLTemplate } from '../expo-sqlite/session.ts';
import type { OpSqliteSQLTemplate } from '../op-sqlite/session.ts';

export type SqliteIdentifierObject = {
	table?: string;
	column?: string;
	as?: string;
};

export class SqliteDialect extends Dialect {
	escapeParam(): string {
		return `?`;
	}

	escapeIdentifier(identifier: string): string {
		return `"${identifier}"`;
	}

	checkIdentifierObject(object: SqliteIdentifierObject) {
		if (Object.values(object).includes(undefined!)) {
			throw new Error(
				`you can't specify undefined parameters. maybe you want to omit it?`,
			);
		}

		if (Object.keys(object).length === 0) {
			throw new Error(`you need to specify at least one parameter.`);
		}

		if (Object.keys(object).length === 1 && object.as !== undefined) {
			throw new Error(
				`you can't specify only "as" property. you have to specify "column" or "table" property along with "as".`,
			);
		}

		if (
			!['string', 'undefined'].includes(typeof object.table)
			|| !['string', 'undefined'].includes(typeof object.column)
			|| !['string', 'undefined'].includes(typeof object.as)
		) {
			throw new Error(
				"object properties 'table', 'column', 'as' should be of string type or omitted.",
			);
		}
	}

	valueToSQL(
		{ value, params }: {
			value: Value;
			params: Value[];
		},
	): string {
		if (value instanceof SQLDefault) {
			return value.generateSQL().sql;
		}

		if (typeof value === 'object' && value.constructor.name === 'Object') {
			params.push(JSON.stringify(value));
			return this.escapeParam();
		}

		params.push(value);
		return this.escapeParam();
	}
}

export class UnsafePromise<
	T,
	DriverT extends
		| D1SQLTemplate<T>
		| BetterSqlite3SQLTemplate<T>
		| BunSqliteSQLTemplate<T>
		| LibsqlSQLTemplate<T>
		| DurableSqliteSQLTemplate<T>
		| OpSqliteSQLTemplate<T>
		| ExpoSqliteSQLTemplate<T>,
> {
	constructor(private driver: DriverT) {}

	run(): Omit<UnsafePromise<T, DriverT>, 'run' | 'all'> {
		this.driver.run();
		return this;
	}

	all(): Omit<UnsafePromise<T, DriverT>, 'run' | 'all'> {
		this.driver.all();
		return this;
	}

	stream() {
		return this.driver.stream();
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
