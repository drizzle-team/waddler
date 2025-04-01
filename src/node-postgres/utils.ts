import type { Client as ClientT, Pool as PoolT, QueryArrayConfig, QueryConfig } from 'pg';
import pg from 'pg';
import { NodePgClient } from './driver';

const { types } = pg;

export const isConfig = (data: any): boolean => {
	if (typeof data !== 'object' || data === null) return false;

	if (data.constructor.name !== 'Object') return false;

	if ('connection' in data) {
		const type = typeof data['connection'];
		if (type !== 'string' && type !== 'object' && type !== 'undefined') return false;

		return true;
	}

	if ('client' in data) {
		const type = typeof data['client'];
		if (type !== 'object' && type !== 'undefined') return false;

		return true;
	}

	if ('host' in data) {
		const type = typeof data['host'];
		if (type !== 'string' && type !== 'undefined') return false;

		return true;
	}

	if ('port' in data) {
		const type = typeof data['port'];
		if (type !== 'number' && type !== 'undefined') return false;

		return true;
	}

	if ('user' in data) {
		const type = typeof data['user'];
		if (type !== 'string' && type !== 'undefined') return false;

		return true;
	}

	if ('password' in data) {
		const type = typeof data['user'];
		if (type !== 'string' && type !== 'undefined') return false;

		return true;
	}

	if ('database' in data) {
		const type = typeof data['database'];
		if (type !== 'string' && type !== 'undefined') return false;

		return true;
	}

	if ('ssl' in data) {
		const type = typeof data['ssl'];
		if (type !== 'boolean' && type !== 'undefined') return false;

		return true;
	}

	if (Object.keys(data).length === 0) return true;

	return false;
};

// adapter for pg.Client, pg.Pool
export const dbQuery = async <ParamsType extends any[]>(
	conn: NodePgClient,
	query: string,
	params: ParamsType,
	options: { rowMode: 'array' | 'object' },
) => {
	// params = (params ?? []) as ParamsType;
	const rowMode = options.rowMode;

	// client should be connected before executing query
	const queryConfig: QueryConfig = {
		text: query,
		rowMode,
		types: {
			// @ts-expect-error
			getTypeParser: (typeId: number, format: string) => {
				if (typeId === types.builtins.INTERVAL) return (val: any) => val;
				if (typeId === 1187) return (val: any) => val;
				// @ts-expect-error
				return types.getTypeParser(typeId, format);
			},
		},
	};

	const queryArrayConfig: QueryArrayConfig = {
		text: query,
		types: {
			// @ts-expect-error
			getTypeParser: (typeId: number, format: string) => {
				if (typeId === types.builtins.INTERVAL) return (val: any) => val;
				if (typeId === 1187) return (val) => val;

				// @ts-expect-error
				return types.getTypeParser(typeId, format);
			},
		},
	};

	const queryResult =
		await (rowMode === 'array' ? conn.query(queryConfig, params) : conn.query(queryArrayConfig, params));

	const result = queryResult.rows;

	return result;
};
