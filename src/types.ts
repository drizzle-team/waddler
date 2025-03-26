type ValueForArray = number | bigint | boolean | null | Date | JSONObject | JSONArray;
type ValueForObject = string | number | boolean | null | Date | JSONObject | Array<ValueForObject>;

export type JSONArray = Array<ValueForArray>;

export type JSONObject = { [key: string]: ValueForObject };

export type RowData = {
	[columnName: string]: any;
};

export type IdentifierObject = {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
};
