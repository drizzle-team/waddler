import type { DuckdbIdentifierObject, DuckdbValues } from '../duckdb-core/dialect.ts';
import type { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
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
	| SQLIdentifier<DuckdbIdentifierObject>
	| SQLValues<DuckdbValues>
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
