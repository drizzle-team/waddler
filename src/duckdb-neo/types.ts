import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import type { SQLRaw } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';
import type { DuckdbNeoSQLDefault, DuckdbNeoSQLIdentifier, DuckdbNeoSQLValues } from './sql-template-params';

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
	| DuckdbNeoSQLIdentifier
	| DuckdbNeoSQLValues
	| DuckdbNeoSQLDefault
	| SQLRaw;
