export function makeCockroachArray(array: any[]): string {
	return `{${
		array.map((item) => {
			if (Array.isArray(item)) {
				return makeCockroachArray(item);
			}

			if (typeof item === 'object' && item !== null) {
				item = JSON.stringify(item);
			}

			if (typeof item === 'string') {
				return `"${item.replace(/\\/g, '\\\\').replace(/"/g, String.raw`\"`)}"`;
			}

			return `${item}`;
		}).join(',')
	}}`;
}
