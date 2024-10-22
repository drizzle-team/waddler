import duckdb from 'duckdb';
import * as genericPool from 'generic-pool';
import type { Options } from 'generic-pool';

export class RecyclingPool<T> extends genericPool.Pool<T> {
	private recycleTimeout?: number;
	private recycleJitter?: number;

	constructor(
		factory: Factory<T>,
		options: {
			recycleTimeout?: number;
			recycleJitter?: number;
		} & Options,
	) {
		// @ts-ignore
		super(genericPool.DefaultEvictor, genericPool.Deque, genericPool.PriorityQueue, factory, options);

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
			new Date(createdAt + this.recycleTimeout - (Math.random() * this.recycleJitter!))
				<= new Date()
		) {
			return this.destroy(resource);
		}
		return super.release(resource);
	}
}

interface Factory<T> {
	create(): Promise<T>;
	destroy(connection: T): Promise<void>;
	validate?(connection: T): Promise<boolean>;
}

// Equivalent to createPool function from generic-pool
export function createRecyclingPool<T>(factory: Factory<T>, config: Options) {
	return new RecyclingPool<T>(factory, config);
}

export const createFactory = (
	{ dbUrl, accessMode = 'read_write' }: { dbUrl: string; accessMode?: 'read_only' | 'read_write' },
) => {
	const factory = {
		create: async function() {
			const connection = new duckdb.Database(dbUrl, {
				access_mode: accessMode,
				max_memory: '512MB',
				threads: '4',
			}, (err) => {
				if (err) {
					console.error(err);
				}
			});

			// Run any connection initialization commands here
			connection.all("SET THREADS='1';");

			return connection;
		},
		destroy: async function(connection: duckdb.Database) {
			return connection.close();
		},
	};

	return factory;
};
