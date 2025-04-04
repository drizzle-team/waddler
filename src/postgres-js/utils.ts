export function isConfig(data: any): boolean {
	if (typeof data !== 'object' || data === null) return false;

	if (data.constructor.name !== 'Object') return false;

	if ('mode' in data) {
		if (data['mode'] !== 'default' || data['mode'] !== 'planetscale' || data['mode'] !== undefined) return false;

		return true;
	}

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
