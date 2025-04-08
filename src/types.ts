import type { SQLDefault, SQLIdentifier, SQLRaw, SQLValues } from './sql-template-params.ts';
import type { IdentifierObject, Values } from './sql.ts';

export type ValueForArray = string | Buffer | number | bigint | boolean | null | Date | JSONObject | JSONArray;
export type ValueForObject = string | number | boolean | null | Date | JSONObject | Array<ValueForObject>;

export type JSONArray = Array<ValueForArray>;

export type JSONObject = { [key: string]: ValueForObject };

export type RowData = {
	[columnName: string]: any;
};

// param types that can safely be passed to driver
export type UnsafeParamType =
	| string
	| Buffer
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONObject
	| JSONArray;

export type SQLParamType =
	| string
	| number
	| bigint
	| Date
	| boolean
	| null
	| JSONArray
	| JSONObject
	| SQLIdentifier<IdentifierObject>
	| SQLValues<Values>
	| SQLDefault
	| SQLRaw;

export type isObjectEmpty<O> = keyof O extends never ? true : false;
