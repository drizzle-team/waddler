import type { Connection, Pool } from 'mysql2/promise';

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
