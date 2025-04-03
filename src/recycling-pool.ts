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

	override async release(resource: T) {
		const loan = this._resourceLoans.get(resource);
		const createdAt = loan === undefined ? 0 : loan.pooledResource.creationTime;

		// If the connection has been in use for longer than the recycleTimeoutMillis, then destroy it instead of releasing it back into the pool.
		// If that deletion brings the pool size below the min, the connection will be released (not destroyed)
		if (
			new Date(createdAt + this.recycleTimeout! - (Math.random() * this.recycleJitter!))
				<= new Date() && this._count - 1 >= this.min
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
