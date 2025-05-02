import type { PooledResource } from './PooledResource.ts';

export interface IEvictorConfig {
	softIdleTimeoutMillis: number;
	idleTimeoutMillis: number;
	min: number;
}

export interface IEvictor<T> {
	evict(config: IEvictorConfig, pooledResource: PooledResource<T>, availableObjectsCount: number): boolean;
}

export interface Factory<T> {
	create(): Promise<T>;

	destroy(client: T): Promise<void>;

	validate?(client: T): Promise<boolean>;
}

export interface Options {
	max?: number;
	min?: number;
	maxWaitingClients?: number;
	testOnBorrow?: boolean;
	acquireTimeoutMillis?: number;
	destroyTimeoutMillis?: number;
	fifo?: boolean;
	priorityRange?: number;
	autostart?: boolean;
	evictionRunIntervalMillis?: number;
	numTestsPerEvictionRun?: number;
	softIdleTimeoutMillis?: number;
	idleTimeoutMillis?: number;
}
