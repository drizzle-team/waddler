import type { DuckdbSQLIdentifier, DuckdbSQLValues } from '../duckdb-core/dialect.ts';
import type { SQLDefault, SQLRaw } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';

export type DuckdbSQLParamType =
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

export type RawParam =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONArray
	| JSONObject;
