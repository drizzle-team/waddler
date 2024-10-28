import duckdb from 'duckdb';
import { DefaultEvictor } from './pool-ts/DefaultEvictor.ts';
import { Deque } from './pool-ts/Deque.ts';
import { Pool } from './pool-ts/Pool.ts';
import { PriorityQueue } from './pool-ts/PriorityQueue.ts';
import type { Factory, Options } from './pool-ts/types.ts';

export class RecyclingPool<T> extends Pool<T> {
	private recycleTimeout?: number;
	private recycleJitter?: number;

	constructor(
		factory: Factory<T>,
		options: {
			recycleTimeout?: number;
			recycleJitter?: number;
		} & Options,
	) {
		super(DefaultEvictor, Deque, PriorityQueue, factory, options);

		this.recycleTimeout = options.recycleTimeout ??= 900_000; // 15 min
		this.recycleJitter = options.recycleJitter ??= 60_000; // 1 min
	}

	override release(resource: T) {
		// @ts-ignore
		const loan = this._resourceLoans.get(resource);
		const createdAt = loan === undefined ? 0 : loan.pooledResource.creationTime;

		// If the connection has been in use for longer than the recycleTimeoutMillis, then destroy it instead of releasing it back into the pool.
		// If that deletion brings the pool size below the min, a new connection will automatically be created within the destroy method.
		if (
			new Date(createdAt + this.recycleTimeout! - (Math.random() * this.recycleJitter!))
				<= new Date()
		) {
			return this.destroy(resource);
		}
		return super.release(resource);
	}
}

// Equivalent to createPool function from generic-pool
export function createRecyclingPool<T>(
	factory: Factory<T>,
	options: {
		recycleTimeout?: number;
		recycleJitter?: number;
	} & Options,
) {
	return new RecyclingPool<T>(factory, options);
}

export const createFactory = (
	{
		url,
		accessMode = 'read_write',
		maxMemory = '512MB',
		threads = '4',
	}: {
		url: string;
		accessMode?: 'read_only' | 'read_write';
		maxMemory?: string;
		threads?: string;
	},
) => {
	const factory = {
		create: async function() {
			const db = new duckdb.Database(url, {
				access_mode: accessMode,
				max_memory: maxMemory,
				threads: threads,
			}, (err) => {
				if (err) {
					console.error(err);
				}
			});

			// Run any connection initialization commands here

			return db;
		},
		destroy: async function(db: duckdb.Database) {
			return db.close();
		},
	};

	return factory;
};
