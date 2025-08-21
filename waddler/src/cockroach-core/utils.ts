export function makeCockroachArray(array: any[]): string | undefined {
	let exitFlag = false;
	const mappedArray: any[] = [];

	for (const item of array) {
		if (Array.isArray(item)) {
			const mappedItem = makeCockroachArray(item);
			if (mappedItem === undefined) {
				exitFlag = true;
				break;
			}
			mappedArray.push(mappedItem);
		}

		if (typeof item === 'string') {
			const mappedItem = /(^e')|(^E')/.test(item)
				? `e'${item.slice(2, -1).replace(/'/g, String.raw`\'`)}'`
				: `'${item.replace(/'/g, String.raw`''`)}'`;

			mappedArray.push(mappedItem);
			continue;
		}

		exitFlag = true;
		break;
	}

	if (exitFlag) return;
	return `ARRAY[${mappedArray.join(',')}]`;
}
