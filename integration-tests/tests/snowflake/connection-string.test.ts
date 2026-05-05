import snowflake, { type Connection, type ConnectionCallback, type ConnectionOptions, type RowStatement } from 'snowflake-sdk';
import { afterEach, expect, test, vi } from 'vitest';
import { sql as sqlQuery, waddler } from 'waddler/snowflake';

afterEach(() => {
	vi.restoreAllMocks();
});

const createConnectionMock = () => vi.spyOn(snowflake, 'createConnection').mockReturnValue({} as Connection);

const createExecuteStatement = () => ({
	getQueryId: () => 'query-id',
	getNumRows: () => 1,
	getNumUpdatedRows: () => undefined,
	streamRows: () => {
		throw new Error('not implemented');
	},
	cancel: () => {},
}) as RowStatement;

test('connection string with EXTERNALBROWSER authenticator parameter', () => {
	const snowflakeCreateConnection = createConnectionMock();
	const connectionString = 'snowflake://user@account/db/schema?warehouse=wh&authenticator=externalbrowser';

	try {
		expect(() => {
			waddler(connectionString);
		}).not.toThrow();

		expect(snowflakeCreateConnection).toHaveBeenCalledWith({
			account: 'account',
			username: 'user',
			authenticator: 'EXTERNALBROWSER',
			database: 'db',
			schema: 'schema',
			warehouse: 'wh',
		});
	} finally {
		snowflakeCreateConnection.mockRestore();
	}
});

test('connection string preserves HTTPS authenticator URL and decodes credentials', () => {
	const snowflakeCreateConnection = createConnectionMock();
	const connectionString =
		'snowflake://user%40example.com:100%25Secure@account/db?authenticator=https%3A%2F%2Fmyorg.okta.com';

	try {
		expect(() => {
			waddler(connectionString);
		}).not.toThrow();

		expect(snowflakeCreateConnection).toHaveBeenCalledWith({
			account: 'account',
			username: 'user@example.com',
			password: '100%Secure',
			authenticator: 'https://myorg.okta.com',
			database: 'db',
		});
	} finally {
		snowflakeCreateConnection.mockRestore();
	}
});

test.each([
	'OAUTH',
	'SNOWFLAKE_JWT',
	'USERNAME_PASSWORD_MFA',
	'OAUTH_AUTHORIZATION_CODE',
	'OAUTH_CLIENT_CREDENTIALS',
	'PROGRAMMATIC_ACCESS_TOKEN',
	'WORKLOAD_IDENTITY',
])('connection string rejects authenticator=%s', (authenticator) => {
	const snowflakeCreateConnection = createConnectionMock();
	const connectionString = `snowflake://user:password@account/db?authenticator=${authenticator}`;

	try {
		expect(() => {
			waddler(connectionString);
		}).toThrow(`Snowflake connection strings do not support authenticator=${authenticator}`);
		expect(snowflakeCreateConnection).not.toHaveBeenCalled();
	} finally {
		snowflakeCreateConnection.mockRestore();
	}
});

test('connection string rejects authenticator URLs without https', () => {
	const snowflakeCreateConnection = createConnectionMock();
	const connectionString = 'snowflake://user:password@account/db?authenticator=http%3A%2F%2Fmyorg.okta.com';

	try {
		expect(() => {
			waddler(connectionString);
		}).toThrow('Snowflake connection string authenticator URLs must be an https://*.okta.com URL.');
		expect(snowflakeCreateConnection).not.toHaveBeenCalled();
	} finally {
		snowflakeCreateConnection.mockRestore();
	}
});

test('connection string rejects non-Okta authenticator URLs', () => {
	const snowflakeCreateConnection = createConnectionMock();
	const connectionString = 'snowflake://user:password@account/db?authenticator=https%3A%2F%2Flogin.example.com';

	try {
		expect(() => {
			waddler(connectionString);
		}).toThrow('Snowflake connection string authenticator URLs must be an https://*.okta.com URL.');
		expect(snowflakeCreateConnection).not.toHaveBeenCalled();
	} finally {
		snowflakeCreateConnection.mockRestore();
	}
});

test('connection string rejects unknown authenticator values', () => {
	const snowflakeCreateConnection = createConnectionMock();
	const connectionString = 'snowflake://user:password@account/db?authenticator=NOT_A_REAL_AUTH';

	try {
		expect(() => {
			waddler(connectionString);
		}).toThrow('Snowflake connection strings only support the default/SNOWFLAKE authenticator');
		expect(snowflakeCreateConnection).not.toHaveBeenCalled();
	} finally {
		snowflakeCreateConnection.mockRestore();
	}
});

test('connection string rejects unsupported passwordless authenticator', () => {
	expect(() => {
		waddler('snowflake://user@account/db?authenticator=SNOWFLAKE');
	}).toThrow('Snowflake connection string must include account, username, and password');
});

test('connection string rejects extra path segments', () => {
	expect(() => {
		waddler('snowflake://user:password@account/db/schema/extra');
	}).toThrow('Snowflake connection string path must be /<database>/<schema>');
});

test('connection string rejects malformed percent encoding', () => {
	expect(() => {
		waddler('snowflake://user%ZZ:password@account/db');
	}).toThrow('Invalid Snowflake connection string: malformed percent-encoding in username');
});

test('sql.identifier escapes embedded quotes in Snowflake identifiers', () => {
	const query = sqlQuery`select * from ${sqlQuery.identifier({ database: 'APP"DB', schema: 'PUBLIC', table: 'US"ERS' })};`;

	expect(query.toSQL()).toStrictEqual({
		sql: 'select * from "APP""DB"."PUBLIC"."US""ERS";',
		params: [],
	});
});

test('concurrent queries share a single connectAsync call', async () => {
	let isUp = false;
	let resolveConnect!: () => void;
	const statement = createExecuteStatement();
	let client!: Connection;

	const connectAsync = vi.fn((callback?: ConnectionCallback) => {
		return new Promise<Connection>((resolve) => {
			resolveConnect = () => {
				isUp = true;
				callback?.(undefined, client);
				resolve(client);
			};
		});
	});

	const execute = vi.fn(({ complete }: { complete?: (err: Error | undefined, stmt: RowStatement, rows?: any[]) => void }) => {
		complete?.(undefined, statement, [{ ok: true }]);
		return statement;
	});

	client = {
		isUp: () => isUp,
		connectAsync,
		execute,
	} as Connection;

	const sql = waddler({ client });
	const query1 = sql`select ${1};`.execute();
	const query2 = sql`select ${2};`.execute();

	expect(connectAsync).toHaveBeenCalledTimes(1);
	resolveConnect();

	await expect(Promise.all([query1, query2])).resolves.toStrictEqual([[{ ok: true }], [{ ok: true }]]);
	expect(execute).toHaveBeenCalledTimes(2);
});

test('connectAsync promise-only implementations still unblock queries', async () => {
	let isUp = false;
	let resolveConnect!: () => void;
	const statement = createExecuteStatement();
	let client!: Connection;

	const connectAsync = vi.fn(() => {
		return new Promise<Connection>((resolve) => {
			resolveConnect = () => {
				isUp = true;
				resolve(client);
			};
		});
	});

	const execute = vi.fn(({ complete }: { complete?: (err: Error | undefined, stmt: RowStatement, rows?: any[]) => void }) => {
		complete?.(undefined, statement, [{ ok: true }]);
		return statement;
	});

	client = {
		isUp: () => isUp,
		connectAsync: connectAsync as Connection['connectAsync'],
		execute,
	} as Connection;

	const sql = waddler({ client });
	const query = sql`select 1;`.execute();
	resolveConnect();

	await expect(query).resolves.toStrictEqual([{ ok: true }]);
	expect(connectAsync).toHaveBeenCalledTimes(1);
	expect(execute).toHaveBeenCalledTimes(1);
});

test('queries fall back to connect() when connectAsync is unavailable', async () => {
	let isUp = false;
	const statement = createExecuteStatement();
	let client!: Connection;

	const connect = vi.fn((callback?: ConnectionCallback) => {
		isUp = true;
		callback?.(undefined, client);
		return client;
	});

	const execute = vi.fn(({ complete }: { complete?: (err: Error | undefined, stmt: RowStatement, rows?: any[]) => void }) => {
		complete?.(undefined, statement, [{ ok: true }]);
		return statement;
	});

	client = {
		isUp: () => isUp,
		connect,
		execute,
	} as Connection;

	const sql = waddler({ client });

	await expect(sql`select 1;`.execute()).resolves.toStrictEqual([{ ok: true }]);
	expect(connect).toHaveBeenCalledTimes(1);
	expect(execute).toHaveBeenCalledTimes(1);
});

test('stream() cleans up the underlying Snowflake stream on early exit', async () => {
	const destroy = vi.fn();
	const cancel = vi.fn();
	const stream = (async function* () {
		yield { id: 1 };
		yield { id: 2 };
	})();
	Object.assign(stream, { destroy });

	const statement = {
		getQueryId: () => 'query-id',
		getNumRows: () => 2,
		getNumUpdatedRows: () => undefined,
		streamRows: () => stream,
		cancel,
	} as RowStatement;

	const client = {
		isUp: () => true,
		execute: vi.fn(({ complete }: { complete?: (err: Error | undefined, stmt: RowStatement) => void }) => {
			complete?.(undefined, statement);
			return statement;
		}),
	} as Connection;

	const sql = waddler({ client });

	for await (const _row of sql`select 1;`.stream()) {
		break;
	}

	expect(destroy).toHaveBeenCalledTimes(1);
	expect(cancel).toHaveBeenCalledTimes(1);
});

test('stream() wraps synchronous streamRows failures', async () => {
	const statement = {
		getQueryId: () => 'query-id',
		getNumRows: () => 0,
		getNumUpdatedRows: () => undefined,
		streamRows: () => {
			throw new Error('streamRows failed');
		},
	} as RowStatement;

	const client = {
		isUp: () => true,
		execute: vi.fn(({ complete }: { complete?: (err: Error | undefined, stmt: RowStatement) => void }) => {
			complete?.(undefined, statement);
			return statement;
		}),
	} as Connection;

	const sql = waddler({ client });

	await expect(async () => {
		for await (const _row of sql`select 1;`.stream()) {
			return;
		}
	}).rejects.toThrow('Failed query: select 1;');
});

test('waddler rejects config objects without Snowflake connection details', () => {
	expect(() => {
		waddler({ logger: true });
	}).toThrow('Must be a Snowflake connection string');
});
