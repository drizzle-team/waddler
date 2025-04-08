import type { Connection, Pool } from 'mysql2/promise';

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

type MySql2Client = Pool | Connection;

export function isPool(client: MySql2Client): client is Pool {
	return 'getConnection' in client;
}

interface CallbackClient {
	promise(): MySql2Client;
}

export function isCallbackClient(client: any): client is CallbackClient {
	return typeof client.promise === 'function';
}
