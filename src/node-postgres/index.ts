import type { Client as ClientT, Pool as PoolT } from 'pg';
import pg from 'pg';
import type { PgIdentifierObject, PgValues } from '../pg-core/dialect.ts';
import { PgSQLIdentifier, PgSQLValues } from '../pg-core/dialect.ts';
import type { Identifier, Raw } from '../sql-template-params.ts';
import { SQLDefault, SQLRaw } from '../sql-template-params.ts';
import { NodePgSQLValuesDriver } from './driver.ts';
import { NodePgSQLTemplate } from './sql-template.ts';
import type { NodePgSQLParamType, UnsafeParamType } from './types.ts';
import { dbQuery, isConfig } from './utils.ts';

const { Client, Pool } = pg;

type RowData = {
	[columnName: string]: any;
};

export { SQLTemplate } from '../sql-template.ts';
export interface SQL {
	<T = RowData>(strings: TemplateStringsArray, ...params: NodePgSQLParamType[]): NodePgSQLTemplate<T>;
	identifier(value: Identifier<PgIdentifierObject>): PgSQLIdentifier;
	values(value: PgValues): PgSQLValues;
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

const createSqlTemplate = (
	client: ClientT | PoolT,
): SQL => {
	// [strings, params]: Parameters<SQL>
	const fn = <T>(strings: TemplateStringsArray, ...params: NodePgSQLParamType[]): NodePgSQLTemplate<T> => {
		return new NodePgSQLTemplate<T>(strings, params, client);
	};

	Object.assign(fn, {
		identifier: (value: Identifier<PgIdentifierObject>) => {
			return new PgSQLIdentifier(value);
		},
		values: (value: PgValues) => {
			return new PgSQLValues(value, new NodePgSQLValuesDriver());
		},
		raw: (value: Raw) => {
			return new SQLRaw(value);
		},
		unsafe: async (query: string, params?: UnsafeParamType[], options?: { rowMode?: 'array' | 'object' }) => {
			options = options ?? {};
			options.rowMode = options.rowMode ?? 'object';

			params = params ?? [];

			return await unsafeFunc(
				client,
				query,
				params,
				{ ...options as Required<typeof options> },
			);
		},
		default: new SQLDefault(),
	});

	return fn as any;
};

const unsafeFunc = async (
	client: ClientT | PoolT,
	query: string,
	params: UnsafeParamType[],
	options: { rowMode: 'array' | 'object' },
) => {
	let result;

	// wrapping node-postgres driver error in new js error to add stack trace to it
	try {
		result = await dbQuery(
			client,
			query,
			params,
			options,
		);
	} catch (error) {
		const newError = error instanceof AggregateError
			? new Error(error.errors.map((e) => e.message).join('\n'))
			: new Error((error as Error).message);
		throw newError;
	}

	return result;
};

export function waddler(
	param: string | pg.Client | pg.Pool | pg.PoolConfig | {
		connection: string | pg.PoolConfig;
	} | {
		client: pg.Client | pg.Pool;
	},
) {
	if (typeof param === 'string') {
		const client = new Pool({
			connectionString: param,
		});

		return createSqlTemplate(client);
	}

	if (param instanceof Client || param instanceof Pool) {
		return createSqlTemplate(param);
	}

	if (isConfig(param)) {
		const client = (param as {
			client: pg.Client | pg.Pool;
		}).client;

		const connection = (param as {
			connection: string | pg.PoolConfig;
		}).connection;

		if (client !== undefined) {
			return createSqlTemplate(client);
		}

		if (connection !== undefined) {
			if (typeof connection === 'string') {
				const pool = new Pool({
					connectionString: connection,
				});

				return createSqlTemplate(pool);
			}
			const pool = new Pool(connection);

			return createSqlTemplate(pool);
		}

		const pool = new Pool(param as pg.ClientConfig | pg.PoolConfig);

		return createSqlTemplate(pool);
	}

	throw new Error(
		'Invalid parameter for waddler.'
			+ '\nMust be a string, pg.Client, pg.Pool, { connection: string | pg.PoolConfig }, { client: pg.Client | pg.Pool }, pg.ClientConfig or pg.PoolConfig',
	);
}
