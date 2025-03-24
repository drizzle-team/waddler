import type { SQLRaw } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';
import type { NodePgSQLDefault, NodePgSQLIdentifier, NodePgSQLValues } from './sql-template-params.ts';

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
	| NodePgSQLIdentifier
	| NodePgSQLValues
	| NodePgSQLDefault
	| SQLRaw;
