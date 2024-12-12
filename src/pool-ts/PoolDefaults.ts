/**
 * Create the default settings used by the pool
 *
 * @class
 */
export class PoolDefaults {
	fifo: boolean;
	priorityRange: number;
	testOnBorrow: boolean;
	testOnReturn: boolean;
	autostart: boolean;
	evictionRunIntervalMillis: number;
	numTestsPerEvictionRun: number;
	softIdleTimeoutMillis: number;
	idleTimeoutMillis: number;
	acquireTimeoutMillis: number | undefined;
	destroyTimeoutMillis: number | undefined;
	maxWaitingClients: number | undefined;
	min: number;
	max: number | undefined;
	promiseConstructor: PromiseConstructor;

	constructor() {
		this.fifo = true;
		this.priorityRange = 1;

		this.testOnBorrow = false;
		this.testOnReturn = false;

		this.autostart = true;

		// setting this.evictionRunIntervalMillis to 0 means this._scheduleEvictorRun will not be executed.
		// Therefore, this.softIdleTimeoutMillis and this.idleTimeoutMillis will not have any effect.
		this.evictionRunIntervalMillis = 0;
		this.numTestsPerEvictionRun = 3;
		this.softIdleTimeoutMillis = -1;
		this.idleTimeoutMillis = 30000;

		// FIXME: no defaults!
		this.acquireTimeoutMillis = undefined;
		this.destroyTimeoutMillis = undefined;
		this.maxWaitingClients = undefined;

		this.min = 0;
		this.max = undefined;

		// FIXME: this seems odd?
		this.promiseConstructor = Promise;
	}
}
