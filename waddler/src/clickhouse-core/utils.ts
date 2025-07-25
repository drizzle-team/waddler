import { TupleParam } from '@clickhouse/client';

export function makeClickHouseArray(array: any[], typeToCast?: string) {
	let stringifyArray: boolean = true;
	let baseTypeToCast: string | undefined;

	if (
		typeToCast !== undefined
		&& typeToCast !== 'String'
		&& !typeToCast.includes('Int')
		&& !typeToCast.includes('Float')
		&& !typeToCast.includes('Decimal')
		&& !typeToCast.includes('BOOL')
		&& !typeToCast.includes('Variant')
	) stringifyArray = false;

	const mappedArray: any[] = array.map((value) => {
		if (Array.isArray(value)) {
			const { mappedArray, baseTypeToCast: baseTypeToCast_ } = makeClickHouseArray(value, typeToCast);
			baseTypeToCast = baseTypeToCast_;
			return mappedArray;
		}

		if (value instanceof Date) {
			const stringDate = value.toISOString().replace('T', ' ').replace('Z', '');
			if (typeToCast?.includes('DateTime') && !typeToCast?.includes('DateTime64')) {
				return stringDate.replace(/\.\d+/, '');
			}
			// if typeToCast does not include DateTime (e.g. typeToCast equals to 'String') or includes DateTime64
			return stringDate;
		}

		// Map type
		if (value instanceof Map || value instanceof TupleParam) {
			return value;
		}

		if (typeof value === 'object' && typeof value !== 'bigint' && value !== null) {
			stringifyArray = false;
			baseTypeToCast = 'JSON';
			return JSON.stringify(value);
		}

		if (typeof value === 'string') {
			if (
				!stringifyArray
				|| !Number.isNaN(Number(value))
			) return value;
			return `'${value.replace(/\\/g, '\\\\').replace(/'/g, String.raw`\'`)}'`;
		}

		if (stringifyArray) return `${value}`;
		return value;
	});

	if (typeof mappedArray[0] === 'string' && stringifyArray === true) {
		return { mappedArray: `[${mappedArray.join(',')}]`, baseTypeToCast };
	}
	return { mappedArray, baseTypeToCast };
}

export const getArrayDepth = (value: any[]) => {
	if (!Array.isArray(value)) return 0;
	return 1 + value.reduce((maxDepth, el) => {
		const d = getArrayDepth(el);
		return Math.max(d, maxDepth);
	}, 0);
};
