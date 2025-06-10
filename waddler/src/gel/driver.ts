import type { Client, ConnectOptions } from 'gel';
import createClient from 'gel';
import { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { SQL } from '../sql.ts';
import { SQLWrapper } from '../sql.ts';
import type { Identifier, IdentifierObject, Raw, SQLParamType, UnsafeParamType, Values } from '../types.ts';
import { isConfig } from '../utils.ts';
import { GelDialect, UnsafePromise } from './gel-core/dialect.ts';
import { GelSQLTemplate } from './session.ts';

export interface GelSQL extends Omit<SQL, 'unsafe'> {
	<T = any>(
		strings: TemplateStringsArray,
		...params: SQLParamType[]
	): GelSQLTemplate<T>;
	unsafe<RowMode extends 'array' | 'object'>(
		query: string,
		params?: UnsafeParamType[],
		options?: { rowMode: RowMode },
	): UnsafePromise<
		RowMode extends 'array' ? any[] : {
			[columnName: string]: any;
		},
		GelSQLTemplate<any>
	>;
}

const createSqlTemplate = (
	client: Client,
	dialect: GelDialect,
): GelSQL => {
	const fn = <T>(strings: TemplateStringsArray, ...params: SQLParamType[]): GelSQLTemplate<T> => {
		const sql = new SQLWrapper();
		sql.with({ templateParams: { strings, params } }).prepareQuery(dialect);
		return new GelSQLTemplate<T>(sql, client, dialect);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<IdentifierObject>) => {
			return new SQLIdentifier(value);
		},
		values: (value: Values) => {
			return new SQLValues(value);
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: (
			query: string,
			params?: UnsafeParamType[],
			options?: { rowMode: 'array' | 'object' },
		) => {
			params = params ?? [];
			options = options ?? { rowMode: 'object' };

			const sql = new SQLWrapper();
			sql.with({ rawParams: { query, params } });

			const unsafeDriver = new GelSQLTemplate(sql, client, dialect, options);
			const unsafePromise = new UnsafePromise(unsafeDriver);
			return unsafePromise;
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

// TODO should I add Transaction to Client with union?
export function waddler<TClient extends Client = Client>(
	...params:
		| [string]
		| [
			(
				| {
					connection: string | ConnectOptions;
				}
				| {
					client: TClient;
				}
			),
		]
) {
	const dialect = new GelDialect();

	if (typeof params[0] === 'string') {
		const instance = createClient({ dsn: params[0] });

		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as (({ connection?: ConnectOptions | string; client?: TClient }));

		if (client) return createSqlTemplate(client, dialect);

		const instance = createClient(connection);

		return createSqlTemplate(instance, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
