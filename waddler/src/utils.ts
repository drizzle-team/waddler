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
	) return value;

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === 'object') {
		return JSON.stringify(value);
	}

	if (value === undefined) {
		throw new Error("you can't specify undefined as array value.");
	}

	if (typeof value === 'string') {
		throw new Error("you can't specify string as array value.");
	}
};

export function isConfig(data: any): boolean {
	if (typeof data !== 'object' || data === null) return false;

	if (data.constructor.name !== 'Object') return false;

	if ('connection' in data) {
		const type = typeof data['connection'];
		if (type !== 'string' && type !== 'object' && type !== 'undefined') return false;

		return true;
	}

	if ('client' in data) {
		const type = typeof data['client'];
		if (type !== 'object' && type !== 'function' && type !== 'undefined') return false;

		return true;
	}

	if (Object.keys(data).length === 0) return true;

	return false;
}
