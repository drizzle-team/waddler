import { PoolDefaults } from './PoolDefaults.ts';

interface PoolOptionsConfig {
	max?: number;
	min?: number;
	maxWaitingClients?: number;
	testOnBorrow?: boolean;
	testOnReturn?: boolean;
	acquireTimeoutMillis?: number;
	destroyTimeoutMillis?: number | null;
	priorityRange?: number;
	fifo?: boolean;
	autostart?: boolean;
	evictionRunIntervalMillis?: number;
	numTestsPerEvictionRun?: number;
	softIdleTimeoutMillis?: number;
	idleTimeoutMillis?: number;
	promiseConstructor?: typeof Promise;
}

export class PoolOptions {
	max: number;
	min: number;
	maxWaitingClients: number | undefined;
	testOnBorrow: boolean;
	testOnReturn: boolean;
	acquireTimeoutMillis: number | undefined;
	destroyTimeoutMillis: number | undefined;
	priorityRange: number;
	fifo: boolean;
	autostart: boolean;
	evictionRunIntervalMillis: number;
	numTestsPerEvictionRun: number;
	softIdleTimeoutMillis: number;
	idleTimeoutMillis: number;
	promiseConstructor: typeof Promise;

	constructor(opts: PoolOptionsConfig = {}) {
		const poolDefaults = new PoolDefaults();

		this.fifo = opts.fifo ?? poolDefaults.fifo;

		// TODO: check later: opts.priorityRange shouldn't equal 0, therefore using || operator
		this.priorityRange = opts.priorityRange || poolDefaults.priorityRange;

		this.testOnBorrow = opts.testOnBorrow ?? poolDefaults.testOnBorrow;

		// TODO: rewrite without casting fields and add assertion check on the fields below
		this.testOnReturn = opts.testOnReturn ?? poolDefaults.testOnReturn;

		this.autostart = opts.autostart ?? poolDefaults.autostart;

		this.acquireTimeoutMillis = opts.acquireTimeoutMillis === undefined
			? undefined
			: Number.parseInt(opts.acquireTimeoutMillis.toString(), 10);

		this.destroyTimeoutMillis = opts.destroyTimeoutMillis
			? Number.parseInt(opts.destroyTimeoutMillis.toString(), 10)
			: undefined;

		this.maxWaitingClients = opts.maxWaitingClients === undefined
			? undefined
			: Number.parseInt(opts.maxWaitingClients.toString(), 10);

		this.max = Number.parseInt(opts.max?.toString() || '1', 10);
		this.min = Number.parseInt(opts.min?.toString() || '1', 10);

		this.max = Math.max(Number.isNaN(this.max) ? 1 : this.max, 1);
		this.min = Math.min(Number.isNaN(this.min) ? 1 : this.min, this.max);

		this.evictionRunIntervalMillis = opts.evictionRunIntervalMillis || poolDefaults.evictionRunIntervalMillis;
		this.numTestsPerEvictionRun = opts.numTestsPerEvictionRun || poolDefaults.numTestsPerEvictionRun;
		this.softIdleTimeoutMillis = opts.softIdleTimeoutMillis || poolDefaults.softIdleTimeoutMillis;
		this.idleTimeoutMillis = opts.idleTimeoutMillis || poolDefaults.idleTimeoutMillis;

		this.promiseConstructor = opts.promiseConstructor === undefined
			? poolDefaults.promiseConstructor
			: opts.promiseConstructor;
	}
}
