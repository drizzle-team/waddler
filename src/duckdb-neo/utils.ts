import type { DuckDBArrayType, DuckDBListType, DuckDBPreparedStatement, DuckDBType } from '@duckdb/node-api';
import {
	DuckDBArrayValue,
	DuckDBDateValue,
	DuckDBListValue,
	DuckDBMapValue,
	DuckDBStructValue,
	DuckDBTimestampValue,
	DuckDBTimeValue,
	DuckDBUnionValue,
} from '@duckdb/node-api';
import type { UnsafeParamType } from '~/types';

// Insert params
const MIN_INT32 = -2147483648;
const MAX_INT32 = 2147483647;

export const bindParams = (prepared: DuckDBPreparedStatement, params: UnsafeParamType[]) => {
	for (const [idx, param] of params.entries()) {
		if (param === undefined) {
			throw new Error("you can't specify undefined as parameter.");
		}
		if (typeof param === 'string') {
			prepared.bindVarchar(idx + 1, param);
			continue;
		}

		if (typeof param === 'bigint') {
			prepared.bindBigInt(idx + 1, param);
			continue;
		}

		if (typeof param === 'boolean') {
			prepared.bindBoolean(idx + 1, param);
			continue;
		}

		if (param === null) {
			prepared.bindNull(idx + 1);
			continue;
		}

		if (typeof param === 'number') {
			if (Number.isInteger(param)) {
				if (param >= MIN_INT32 && param <= MAX_INT32) {
					prepared.bindInteger(idx + 1, param);
					continue;
				}

				prepared.bindBigInt(idx + 1, BigInt(param));
				continue;
			}

			prepared.bindDouble(idx + 1, param);
			continue;
		}

		if (param instanceof Date) {
			prepared.bindTimestamp(idx + 1, new DuckDBTimestampValue(BigInt(param.getTime() * 1000)));
			continue;
		}

		if (typeof param === 'object') {
			if (Array.isArray(param)) {
				prepared.bindVarchar(idx + 1, stringifyArray(param));
				continue;
			}

			prepared.bindVarchar(idx + 1, JSON.stringify(param));
			continue;
		}
	}
};

export const stringifyArray = (array: any[] | any): string => {
	if (!Array.isArray(array)) {
		return transformValueForArray(array);
	}

	let returnStr = '[';
	for (const [idx, el] of array.entries()) {
		returnStr += `${stringifyArray(el)}`;

		if (idx === array.length - 1) continue;
		returnStr += ',';
	}

	returnStr += ']';

	return returnStr;
};

export const transformValueForArray = (value: any) => {
	if (
		value === null
		|| typeof value === 'number'
		|| typeof value === 'boolean'
		|| typeof value === 'bigint'
		|| typeof value === 'string' // TODO: revise (not gonna work if string contain coma)
	) return value;

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === 'object') {
		return JSON.stringify(value);
	}

	if (value === undefined) {
		throw new Error("you can't specify undefined as arrat value.");
	}
};

// select
const transformIsNeeded = (value: any, columnType?: DuckDBType) => {
	const valueTypes = new Set(['string', 'boolean', 'number', 'bigint']);
	if ((valueTypes.has(typeof value) && columnType === undefined) || value === null) {
		return false;
	}

	return true;
};

export const transformValue = (value: any, columnType?: DuckDBType | undefined) => {
	if (transformIsNeeded(value, columnType) === false) {
		return value;
	}

	if (value instanceof DuckDBDateValue) {
		// value in days
		return (new Date(value.days * 24 * 60 * 60 * 1000));
	}

	if (value instanceof DuckDBTimeValue) {
		// typeof value === "bigint"; time in microseconds since 00:00:00
		let microS = Number(value.micros);
		const microSInHour = 1000 * 1000 * 60 * 60;
		const hours = Math.floor(microS / microSInHour);

		microS = microS - (hours * microSInHour);
		const microSInMinute = 1000 * 1000 * 60;
		const minutes = Math.floor(microS / microSInMinute);

		microS = microS - (minutes * microSInMinute);
		const microSInSecond = 1000 * 1000;
		const seconds = Math.floor(microS / microSInSecond);

		microS = microS - (seconds * microSInSecond);
		const milliS = Math.floor(microS / 1000);

		return (`${hours}:${minutes}:${seconds}.${milliS}`);
	}

	if (value instanceof DuckDBTimestampValue) {
		// typeof value === "bigint"
		return (new Date(Number((value.micros as bigint) / BigInt(1000))));
	}

	if (
		value instanceof DuckDBListValue || value instanceof DuckDBArrayValue
	) {
		const transformedArray = generateNDList(value, columnType as DuckDBListType | DuckDBArrayType | undefined);
		return transformedArray;
	}

	if (value instanceof DuckDBMapValue) {
		const valueMap = new Map();

		for (const valueI of value.entries) {
			valueMap.set(
				transformValue(valueI.key),
				transformValue(valueI.value),
			);
		}

		return valueMap;
	}

	if (typeof value === 'string' && columnType?.alias === 'JSON') {
		return JSON.parse(value);
	}

	if (value instanceof DuckDBStructValue) {
		const valueStruct: { [name: string]: any } = {};
		for (const [keyI, valueI] of Object.entries(value.entries)) {
			valueStruct[keyI] = transformValue(valueI, columnType);
		}

		return valueStruct;
	}

	if (value instanceof DuckDBUnionValue) {
		const transformedValue: any = transformValue(value.value);
		return transformedValue;
	}

	return value;
};

export const generateNDList = (
	listValue: DuckDBListValue | DuckDBArrayValue | any,
	columnType?: DuckDBListType | DuckDBArrayType | any,
): any[] => {
	if (!(listValue instanceof DuckDBListValue) && !(listValue instanceof DuckDBArrayValue)) {
		return transformValue(listValue, columnType);
	}

	const nDList = [];
	for (const item of listValue.items) {
		nDList.push(generateNDList(item, columnType?.valueType as DuckDBListType | DuckDBArrayType | undefined));
	}

	return nDList;
};
