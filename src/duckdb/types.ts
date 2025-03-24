import type { SQLRaw } from '../sql-template-params.ts';
import type { JSONArray, JSONObject } from '../types.ts';
import type { DuckdbSQLDefault, DuckdbSQLIdentifier, DuckdbSQLValues } from './sql-template-params.ts';

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
	| DuckdbSQLDefault
	| SQLRaw;
