import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

export type ParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null;

export type UnsafeParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONObject
	| JSONArray;

type ValueForArray = number | bigint | boolean | null | Date | JSONObject | JSONArray;
type ValueForObject = string | number | bigint | boolean | null | Date | JSONObject | Array<ValueForObject>;

export type JSONArray = Array<ValueForArray>;

export type JSONObject = { [key: string]: ValueForObject };

export interface DuckDBConnectionObj {
	instance: DuckDBInstance;
	connection: DuckDBConnection;
}