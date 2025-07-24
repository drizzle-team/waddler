export function makeClickHouseArray(array: any[], typeToCast?: string) {
	let stringifyArray: boolean = true;

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
			return makeClickHouseArray(value, typeToCast);
		}

		if (value instanceof Date) {
			const stringDate = value.toISOString().replace('T', ' ').replace('Z', '');
			if (typeToCast?.includes('DateTime64')) {
				return stringDate;
			}
			if (typeToCast?.includes('DateTime')) {
				return stringDate.replace(/\.\d+/, '');
			}
			// if (typeToCast?.includes('DateTime'))
			return `'${stringDate}'`;
		}

		if (typeof value === 'object' && typeof value !== 'bigint' && value !== null) {
			if (typeToCast?.includes('JSON')) {
				return JSON.stringify(value);
			}
			// Map type case
			return value;
		}

		if (typeof value === 'string') {
			if (
				!stringifyArray
				|| typeToCast?.includes('Int')
				|| typeToCast?.includes('Float')
				|| typeToCast?.includes('Decimal')
			) return value;
			return `'${value.replace(/\\/g, '\\\\').replace(/'/g, String.raw`\'`)}'`;
		}

		if (stringifyArray) return `${value}`;
		return value;
	});

	if (typeof mappedArray[0] === 'string' && stringifyArray === true) return `[${mappedArray.join(',')}]`;
	return mappedArray;
}
