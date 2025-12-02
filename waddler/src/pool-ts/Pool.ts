'use strict';

import type { DefaultEvictor } from './DefaultEvictor.ts';
import { Deferred } from './Deferred.ts';
import type { Deque } from './Deque.ts';
import type { DequeIterator } from './DequeIterator.ts';
import { validateFactory as factoryValidator } from './factoryValidator.ts';
import { PooledResource } from './PooledResource.ts';
import { PoolOptions } from './PoolOptions.ts';
import type { PriorityQueue } from './PriorityQueue.ts';
import { ResourceLoan } from './ResourceLoan.ts';
import { ResourceRequest } from './ResourceRequest.ts';
import type { Factory, Options } from './types.ts';
import { reflector } from './utils.ts';

export class Pool<T> {
	private _config: PoolOptions;
	private promiseConstructor: typeof Promise;
	private _factory: Factory<T>;
	private _draining: boolean;
	private _started: boolean;
	private _waitingClientsQueue: PriorityQueue<T>;
	private _factoryCreateOperations: Set<Promise<any>>;
	private _factoryDestroyOperations: Set<Promise<any>>;
	private _availableObjects: Deque<PooledResource<T>>;
	private _testOnBorrowResources: Set<PooledResource<T>>;
	private _testOnReturnResources: Set<PooledResource<T>>;
	private _validationOperations: Set<Promise<any>>;
	private _allObjects: Set<PooledResource<T>>;
	protected _resourceLoans: Map<T, ResourceLoan<T>>;
	private _evictionIterator: DequeIterator<PooledResource<T>>;
	private _evictor: DefaultEvictor<T>;
	private _scheduledEviction: NodeJS.Timeout | null;

	constructor(
		Evictor: typeof DefaultEvictor,
		dequeConstructor: typeof Deque,
		priorityQueueConstructor: typeof PriorityQueue,
		factory: Factory<T>,
		options?: Options,
	) {
		factoryValidator(factory);

		this._config = new PoolOptions(options);
		this.promiseConstructor = this._config.promiseConstructor;

		this._factory = factory;
		this._draining = false;
		this._started = false;
		this._waitingClientsQueue = new priorityQueueConstructor(this._config.priorityRange);
		this._factoryCreateOperations = new Set();
		this._factoryDestroyOperations = new Set();
		this._availableObjects = new dequeConstructor();
		this._testOnBorrowResources = new Set();
		this._testOnReturnResources = new Set();
		this._validationOperations = new Set();
		this._allObjects = new Set();
		this._resourceLoans = new Map();
		this._evictionIterator = this._availableObjects.iterator();
		this._evictor = new Evictor();
		this._scheduledEviction = null;
	}

	private async _destroy(pooledResource: PooledResource<T>, ensureMinimum: boolean = true) {
		pooledResource.invalidate();
		this._allObjects.delete(pooledResource);
		await this._factory.destroy(pooledResource.obj);

		if (ensureMinimum === true) await this._ensureMinimum();
	}

	// not in use for now
	private _applyDestroyTimeout(promise: Promise<void>) {
		const timeoutPromise = new this.promiseConstructor((resolve, reject) => {
			setTimeout(() => {
				reject(new Error('destroy timed out'));
				// TODO: figure out why @ts-expect-error triggers 'error TS2578: Unused '@ts-expect-error' directive.' while building
				// @ts-ignore
			}, this._config.destroyTimeoutMillis!).unref();
		});
		return this.promiseConstructor.race([timeoutPromise, promise]);
	}

	// not in use because this._config.testOnBorrow default equals false
	private _testOnBorrow(): boolean {
		if (this._availableObjects.length < 1) {
			return false;
		}

		const pooledResource = this._availableObjects.shift()!;
		pooledResource.test();
		this._testOnBorrowResources.add(pooledResource);

		const validationPromise = (this._factory.validate === undefined)
			? Promise.resolve(true)
			: this._factory.validate(pooledResource.obj);

		const wrappedValidationPromise = this.promiseConstructor.resolve(validationPromise);

		this._trackOperation(
			wrappedValidationPromise,
			this._validationOperations,
		).then((isValid) => {
			this._testOnBorrowResources.delete(pooledResource);

			if (!isValid) {
				pooledResource.invalidate();
				this._destroy(pooledResource);
				this._dispense();
				return;
			}
			this._dispatchPooledResourceToNextWaitingClient(pooledResource);
		});

		return true;
	}

	private _dispatchResource(): boolean {
		if (this._availableObjects.length < 1) {
			return false;
		}

		const pooledResource = this._availableObjects.shift()!;
		return this._dispatchPooledResourceToNextWaitingClient(pooledResource);
	}

	private async _dispense() {
		const numWaitingClients = this._waitingClientsQueue.length;

		if (numWaitingClients < 1) {
			return;
		}

		const resourceShortfall = numWaitingClients - this._potentiallyAllocableResourceCount;

		const actualNumberOfResourcesToCreate = Math.min(
			this.spareResourceCapacity,
			resourceShortfall,
		);

		const resourceCreationPromiseList = [];
		for (let i = 0; actualNumberOfResourcesToCreate > i; i++) {
			resourceCreationPromiseList.push(this._createResource());
		}
		await Promise.all(resourceCreationPromiseList);

		// this._config.testOnBorrow default equals false
		if (this._config.testOnBorrow) {
			const desiredNumberOfResourcesToMoveIntoTest = numWaitingClients - this._testOnBorrowResources.size;
			const actualNumberOfResourcesToMoveIntoTest = Math.min(
				this._availableObjects.length,
				desiredNumberOfResourcesToMoveIntoTest,
			);
			for (let i = 0; actualNumberOfResourcesToMoveIntoTest > i; i++) {
				this._testOnBorrow();
			}
		}

		if (!this._config.testOnBorrow) {
			const actualNumberOfResourcesToDispatch = Math.min(
				this._availableObjects.length,
				numWaitingClients,
			);
			for (let i = 0; actualNumberOfResourcesToDispatch > i; i++) {
				this._dispatchResource();
			}
		}
	}

	private _dispatchPooledResourceToNextWaitingClient(
		pooledResource: PooledResource<T>,
	): boolean {
		// TODO: i might need to iterate over the waitingClientsQueue using while loop skipping the non-pending clients
		const clientResourceRequest = this._waitingClientsQueue.dequeue();
		if (
			clientResourceRequest === null
			|| clientResourceRequest.state !== Deferred.PENDING
		) {
			this._addPooledResourceToAvailableObjects(pooledResource);
			return false;
		}
		const loan = new ResourceLoan<T>(pooledResource, this.promiseConstructor);
		this._resourceLoans.set(pooledResource.obj, loan);
		pooledResource.allocate();

		clientResourceRequest.resolve(pooledResource.obj);
		return true;
	}

	// not in use for now
	private _trackOperation(
		operation: Promise<any>,
		set: Set<Promise<any>>,
	): Promise<any> {
		set.add(operation);

		return operation.then(
			(v) => {
				set.delete(operation);
				return this.promiseConstructor.resolve(v);
			},
			(e) => {
				set.delete(operation);
				return this.promiseConstructor.reject(e);
			},
		);
	}

	private async _createResource() {
		const factoryPromise = this._factory.create();
		try {
			this._factoryCreateOperations.add(factoryPromise);

			const resource: T = await factoryPromise;
			const pooledResource = new PooledResource(resource);
			this._allObjects.add(pooledResource);
			this._addPooledResourceToAvailableObjects(pooledResource);

			this._factoryCreateOperations.delete(factoryPromise);
			await this._dispense();
		} catch (error) {
			await this._dispense();
			this._factoryCreateOperations.delete(factoryPromise);

			throw error;
		}
	}

	private async _ensureMinimum() {
		if (this._draining === true) {
			return;
		}

		const resourceCreationPromiseList = [];
		const minShortfall = this._config.min - this._count;
		for (let i = 0; i < minShortfall; i++) {
			resourceCreationPromiseList.push(this._createResource());
		}

		await Promise.all(resourceCreationPromiseList);
	}

	// not in use for now
	private _evict(): void {
		const testsToRun = Math.min(
			this._config.numTestsPerEvictionRun,
			this._availableObjects.length,
		);
		const evictionConfig = {
			softIdleTimeoutMillis: this._config.softIdleTimeoutMillis,
			idleTimeoutMillis: this._config.idleTimeoutMillis,
			min: this._config.min,
		};
		for (let testsHaveRun = 0; testsHaveRun < testsToRun;) {
			const iterationResult = this._evictionIterator.next();

			if (iterationResult.done === true && this._availableObjects.length < 1) {
				this._evictionIterator.reset();
				return;
			}
			if (iterationResult.done === true && this._availableObjects.length > 0) {
				this._evictionIterator.reset();
				continue;
			}

			const resource = iterationResult.value!;

			const shouldEvict = this._evictor.evict(
				evictionConfig,
				resource,
				this._availableObjects.length,
			);
			testsHaveRun++;

			if (shouldEvict === true) {
				this._evictionIterator.remove();
				this._destroy(resource);
			}
		}
	}

	// not in use because this._config.evictionRunIntervalMillis default equals 0
	private _scheduleEvictorRun(): void {
		// this._config.evictionRunIntervalMillis default equals 0
		if (this._config.evictionRunIntervalMillis > 0) {
			this._scheduledEviction = setTimeout(() => {
				this._evict();
				this._scheduleEvictorRun();
				// TODO: figure out why @ts-expect-error triggers 'error TS2578: Unused '@ts-expect-error' directive.' while building
				// @ts-ignore
			}, this._config.evictionRunIntervalMillis).unref();
		}
	}

	// not in use for now
	private _descheduleEvictorRun(): void {
		if (this._scheduledEviction) {
			clearTimeout(this._scheduledEviction);
		}
		this._scheduledEviction = null;
	}

	async start() {
		if (this._draining === true || this._started === true) return;

		this._started = true;
		try {
			this._scheduleEvictorRun();
			await this._ensureMinimum();
		} catch (error) {
			this._started = false;
			throw error;
		}
	}

	async acquire(priority?: number) {
		if (this._started === false) {
			await this.start();
		}

		if (this._draining) {
			throw new Error('pool is draining and cannot accept work');
		}

		if (
			this.spareResourceCapacity < 1
			&& this._availableObjects.length < 1
			&& this._config.maxWaitingClients !== undefined
			&& this._waitingClientsQueue.length >= this._config.maxWaitingClients
		) {
			throw new Error('max waitingClients count exceeded');
		}

		const resourceRequest = new ResourceRequest<T>(
			this._config.acquireTimeoutMillis,
			this.promiseConstructor,
		);
		this._waitingClientsQueue.enqueue(resourceRequest, priority);
		try {
			await this._dispense();
		} catch (error) {
			if (resourceRequest.state === Deferred.PENDING) {
				resourceRequest.reject(error);
			}
			throw error;
		}

		return resourceRequest.promise;
	}

	// not in use for now
	async use<T>(fn: (resource: any) => Promise<T>, priority?: number): Promise<T> {
		const resource_1 = await this.acquire(priority);
		return await fn(resource_1).then(
			(result) => {
				this.release(resource_1);
				return result;
			},
			(err) => {
				this.destroy(resource_1);
				throw err;
			},
		);
	}

	// not in use for now
	isBorrowedResource(resource: T): boolean {
		return this._resourceLoans.has(resource);
	}

	async release(resource: T): Promise<void> {
		const loan = this._resourceLoans.get(resource);

		if (loan === undefined) {
			throw new Error('Resource not currently part of this pool');
		}

		this._resourceLoans.delete(resource);

		// TODO: revise(not sure if this line is doing anything)
		loan.resolve(resource);

		const pooledResource = loan.pooledResource;

		pooledResource.deallocate();
		this._addPooledResourceToAvailableObjects(pooledResource);

		await this._dispense();
	}

	async destroy(resource: T): Promise<void> {
		const loan = this._resourceLoans.get(resource);

		if (loan === undefined) {
			throw new Error('Resource not currently part of this pool');
		}

		this._resourceLoans.delete(resource);

		// TODO: revise(not sure if this line is doing anything)
		loan.resolve(resource);
		const pooledResource = loan.pooledResource;

		pooledResource.deallocate();
		if (this._count - 1 >= this.min) {
			await this._destroy(pooledResource);
		} else {
			this._addPooledResourceToAvailableObjects(pooledResource);
		}

		await this._dispense();
	}

	private _addPooledResourceToAvailableObjects(pooledResource: PooledResource<T>): void {
		pooledResource.idle();
		if (this._config.fifo === true) {
			this._availableObjects.push(pooledResource);
		} else {
			this._availableObjects.unshift(pooledResource);
		}
	}

	// not in use for now
	async drain(): Promise<void> {
		this._draining = true;
		await this.__allResourceRequestsSettled();
		await this.__allResourcesReturned();
		this._descheduleEvictorRun();
		// TODO: revise
		this._draining = false;
	}

	// not in use for now
	private __allResourceRequestsSettled(): Promise<void> {
		if (this._waitingClientsQueue.length > 0) {
			return reflector(this._waitingClientsQueue.tail!.promise);
		}
		return Promise.resolve();
	}

	// not in use due to not using drain method
	private __allResourcesReturned(): Promise<void[]> {
		const ps = [...this._resourceLoans.values()]
			.map((loan) => loan.promise)
			.map((element) => reflector(element));
		return Promise.all(ps);
	}

	// not in use for now
	async clear(ensureMinimum: boolean = true): Promise<void> {
		const reflectedCreatePromises = [...this._factoryCreateOperations]
			.map((element) => reflector(element));

		await Promise.all(reflectedCreatePromises);
		for (const resource of this._availableObjects) {
			await this._destroy(resource, ensureMinimum);
		}
		const reflectedDestroyPromises = [...this._factoryDestroyOperations]
			.map((element_1) => reflector(element_1));
		return await reflector(Promise.all(reflectedDestroyPromises));
	}

	async end(): Promise<void> {
		await this.drain();
		await this.clear(false);
		this._started = false;
	}

	// not in use for now
	ready(): Promise<void> {
		return new Promise((resolve) => {
			const isReady = () => {
				if (this.available >= this.min) {
					resolve();
				} else {
					setTimeout(isReady, 100);
				}
			};

			isReady();
		});
	}

	get _potentiallyAllocableResourceCount(): number {
		return (
			this._availableObjects.length
			+ this._testOnBorrowResources.size
			+ this._testOnReturnResources.size
			+ this._factoryCreateOperations.size
		);
	}

	get _count(): number {
		return this._allObjects.size + this._factoryCreateOperations.size;
	}

	get spareResourceCapacity(): number {
		return (
			this._config.max
			- (this._allObjects.size + this._factoryCreateOperations.size)
		);
	}

	get size(): number {
		return this._count;
	}

	get available(): number {
		return this._availableObjects.length;
	}

	get borrowed(): number {
		return this._resourceLoans.size;
	}

	get pending(): number {
		return this._waitingClientsQueue.length;
	}

	get max(): number {
		return this._config.max;
	}

	get min(): number {
		return this._config.min;
	}
}
