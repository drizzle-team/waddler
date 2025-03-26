import type { PgIdentifierObject, PgValues } from '../pg-core/dialect.ts';
import type { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';

// param types that can safely be passed to driver
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
	| SQLIdentifier<PgIdentifierObject>
	| SQLValues<PgValues>
	| SQLDefault
	| SQLRaw;
