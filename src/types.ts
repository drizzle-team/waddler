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

type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

type JSONArray = Array<JSONValue>;

type JSONObject = { [key: string]: JSONValue };
