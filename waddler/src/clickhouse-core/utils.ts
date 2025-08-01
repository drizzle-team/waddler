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

export const inspectArray = (value: any[]): { depth: number; type: string } => {
	if (Array.isArray(value)) {
		const { depth, type } = inspectArray(value[0]);
		return { depth: depth + 1, type };
	}

	return { depth: 0, type: typeof value };
};

export const inspectArray1 = (value: any[]): { depth: number; type: string } => {
	let currNode: any | any[] = value;
	let depth: number = 0;

	for (let i = 0; i < 100; i++) {
		if (!Array.isArray(currNode)) return { depth, type: typeof currNode };
		currNode = currNode[0];
		depth++;
	}

	return { depth, type: typeof value };
};

// console.log(inspectArray(['a', 'b']));
// console.log(inspectArray([['a', 'b'], ['a', 'b']]));
// console.log(inspectArray([[['a', 'b'], ['a', 'b']], [['a', 'b'], ['a', 'b']]]));

// console.log(inspectArray1(['a', 'b']));
// console.log(inspectArray1([['a', 'b'], ['a', 'b']]));
// console.log(inspectArray1([[['a', 'b'], ['a', 'b']], [['a', 'b'], ['a', 'b']]]));
