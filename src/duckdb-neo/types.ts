import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import type { DuckdbSQLIdentifier, DuckdbSQLValues } from '../duckdb-core/dialect.ts';
import type { SQLDefault, SQLRaw } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';

export interface DuckDBConnectionObj {
	instance: DuckDBInstance;
	connection: DuckDBConnection;
}

export type UnsafeParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONObject
	| JSONArray;

export type DuckdbNeoSQLParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONArray
	| JSONObject
	| DuckdbSQLIdentifier
	| DuckdbSQLValues
	| SQLDefault
	| SQLRaw;
