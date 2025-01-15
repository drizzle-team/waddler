import crypto from 'crypto';
import { expect, test } from 'vitest';
import { createRecyclingPool } from '../src/recycling-pool';

const sleep = (ms: number) => {
	return new Promise(
		(resolve) => setTimeout(resolve, ms),
	);
};

class Connection {
	public connectionId: string;
	constructor() {
		this.connectionId = crypto.randomUUID();
	}
}

test('basic pool test', async () => {
	const pool = createRecyclingPool(
		{
			create: async () => {
				return { connection: 'connection' };
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 0,
			max: 1,
		},
	);

	const connObj = await pool.acquire();
	expect(connObj.connection).toBe('connection');
	await pool.release(connObj);
});

test('ensure minimum pool size test', async () => {
	// pool should not destroy connections if min pool size equals max pool size
	// --------------------------------------------------------------------------------------------
	let pool = createRecyclingPool(
		{
			create: async () => {
				return new Connection();
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 1,
			max: 1,
		},
	);

	let connObj = await pool.acquire();
	const connIdPrev = connObj.connectionId;
	await sleep(500);
	await pool.release(connObj);

	connObj = await pool.acquire();
	const connIdNext = connObj.connectionId;
	await pool.release(connObj);

	expect(connIdPrev).equal(connIdNext);

	// --------------------------------------------------------------------------------------------
	const minConnNumber = 8;
	pool = createRecyclingPool(
		{
			create: async () => {
				return new Connection();
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: minConnNumber,
			max: minConnNumber,
		},
	);

	const connObjListPrev = [];
	const connIdsPrev = [];
	for (let i = 0; i < minConnNumber; i++) {
		connObj = await pool.acquire();
		connObjListPrev.push(connObj);
		connIdsPrev.push(connObj.connectionId);
	}
	await sleep(500);
	for (const connObj of connObjListPrev) {
		await pool.release(connObj);
	}

	const connObjListNext = [];
	const connIdsNext: string[] = [];
	for (let i = 0; i < minConnNumber; i++) {
		connObj = await pool.acquire();
		connObjListNext.push(connObj);
		connIdsNext.push(connObj.connectionId);
	}
	for (const connObj of connObjListNext) {
		await pool.release(connObj);
	}

	expect(
		connIdsPrev.every((connId) => connIdsNext.includes(connId)),
	).toBe(true);

	// pool will create min number of connections after first acquire
	// --------------------------------------------------------------------------------------------
	pool = createRecyclingPool(
		{
			create: async () => {
				return new Connection();
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 4,
			max: 8,
		},
	);

	expect(pool.size).toBe(0);

	connObj = await pool.acquire();

	expect(pool.size).toBe(4);

	await pool.release(connObj);
});

test('try catch error test', async () => {
	const pool = createRecyclingPool(
		{
			create: async () => {
				throw new Error('create error');
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 4,
			max: 8,
		},
	);

	await expect(pool.acquire()).rejects.toThrow('create error');
});

test('recycle timeout test', async () => {
	let pool = createRecyclingPool(
		{
			create: async () => {
				return new Connection();
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 0,
			max: 1,
		},
	);

	let connObj = await pool.acquire();
	const connId = connObj.connectionId;
	await sleep(500);
	await pool.release(connObj);

	const connObjNext = await pool.acquire();
	await pool.release(connObjNext);
	expect(connObjNext.connectionId).not.toBe(connId);

	// --------------------------------------------------------------------------------------------
	const maxConnNumber = 8;
	pool = createRecyclingPool(
		{
			create: async () => {
				return new Connection();
			},
			destroy: async () => {},
		},
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 0,
			max: maxConnNumber,
		},
	);

	const connObjListPrev = [];
	const connIdsPrev = [];
	for (let i = 0; i < maxConnNumber; i++) {
		connObj = await pool.acquire();
		connObjListPrev.push(connObj);
		connIdsPrev.push(connObj.connectionId);
	}
	await sleep(500);
	for (const connObj of connObjListPrev) {
		await pool.release(connObj);
	}

	const connObjListNext = [];
	const connIdsNext: string[] = [];
	for (let i = 0; i < maxConnNumber; i++) {
		connObj = await pool.acquire();
		connObjListNext.push(connObj);
		connIdsNext.push(connObj.connectionId);
	}
	for (const connObj of connObjListNext) {
		await pool.release(connObj);
	}

	expect(
		connIdsPrev.every((connId) => !connIdsNext.includes(connId)),
	).toBe(true);
});

test('work after error', async () => {
	const factory = {
		create: async () => {
			return new Connection();
		},
		destroy: async () => {},
	};

	const pool = createRecyclingPool(
		factory,
		{
			recycleTimeout: 300,
			recycleJitter: 100,
			min: 0,
			max: 2,
		},
	);

	const connObj = await pool.acquire();
	expect(connObj.connectionId).toBeDefined();

	factory.create = async () => {
		throw new Error('create error');
	};

	await expect(pool.acquire()).rejects.toThrow('create error');

	factory.create = async () => {
		return new Connection();
	};

	const connObj2 = await pool.acquire();
	expect(connObj2.connectionId).toBeDefined();
	await pool.release(connObj);
	await pool.release(connObj2);
});
