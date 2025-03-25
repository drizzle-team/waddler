import type { PgSQLIdentifier, PgSQLValues } from '../pg-core/dialect.ts';
import type { SQLDefault, SQLRaw } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';

export type UnsafeParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONObject
	| JSONArray;

export type NodePgSQLParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONArray
	| JSONObject
	| PgSQLIdentifier
	| PgSQLValues
	| SQLDefault
	| SQLRaw;
