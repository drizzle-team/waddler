// import type { DateDuration, Duration, LocalDate, LocalDateTime, LocalTime, RelativeDuration } from 'gel';
import type { SQLDefault } from './sql-template-params.ts';

export type ValueForArray = string | Buffer | number | bigint | boolean | null | Date | JSONObject | JSONArray;
export type ValueForObject = string | number | boolean | null | Date | JSONObject | Array<ValueForObject>;

export type JSONArray = Array<ValueForArray>;

export type JSONObject = { [key: string]: ValueForObject };

export type RowData = {
	[columnName: string]: any;
};

// param types that will be passed to driver
export type UnsafeParamType = any;
// | string
// | Buffer
// | number
// | bigint
// | boolean
// | Date
// | null
// | Uint8Array
// | LocalDateTime
// | LocalDate
// | LocalTime
// | Duration
// | RelativeDuration
// | DateDuration
// | JSONObject
// | JSONArray
// | UnsafeParamType[];

// SQL params---------------------------------------------------------------

export type SQLParamType = any;
// | string
// | Buffer
// | number
// | bigint
// | Date
// | boolean
// | null
// | JSONArray
// | JSONObject
// | SQLIdentifier<IdentifierObject>
// | SQLValues
// | SQLDefault
// | SQLRaw;

export type Identifier<Q extends IdentifierObject> =
	| string
	| string[]
	| Q
	| Q[];

export type IdentifierObject = {
	schema?: string;
	table?: string;
	column?: string;
	as?: string;
};

export type Value =
	| Value_
	| SQLDefault;

type Value_ = any;
// | string
// | Buffer
// | number
// | bigint
// | boolean
// | Date
// | null
// | Uint8Array
// | LocalDateTime
// | LocalDate
// | LocalTime
// | Duration
// | RelativeDuration
// | DateDuration
// | JSONObject
// | JSONArray
// | Value_[];

export type Values = Value[][];

export type Raw = string | number | boolean | bigint;

// ------------------------------------------------------------------------------------

// Utils types
export type isObjectEmpty<O> = keyof O extends never ? true : false;

export type IfNotImported<T, Y, N> = unknown extends T ? Y : N;

export type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
