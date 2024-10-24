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

// const FACTORY_CREATE_ERROR = "factoryCreateError";
// const FACTORY_DESTROY_ERROR = "factoryDestroyError";

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
	private _resourceLoans: Map<T, ResourceLoan<T>>;
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

		if (this._config.autostart === true) {
			this.start();
		}
	}

	private _destroy(pooledResource: PooledResource<T>) {
		pooledResource.invalidate();
		this._allObjects.delete(pooledResource);
		const destroyPromise = this._factory.destroy(pooledResource.obj);
		const wrappedDestroyPromise = this._config.destroyTimeoutMillis
			? this.promiseConstructor.resolve(this._applyDestroyTimeout(destroyPromise))
			: this.promiseConstructor.resolve(destroyPromise);

		this._trackOperation(
			wrappedDestroyPromise,
			this._factoryDestroyOperations,
		).catch((_reason) => {
			console.log();
			// TODO: handle
			//   this.emit(FACTORY_DESTROY_ERROR, reason);
		});

		this._ensureMinimum();
	}

	private _applyDestroyTimeout(promise: Promise<void>) {
		const timeoutPromise = new this.promiseConstructor((resolve, reject) => {
			setTimeout(() => {
				reject(new Error('destroy timed out'));
			}, this._config.destroyTimeoutMillis!).unref();
		});
		return this.promiseConstructor.race([timeoutPromise, promise]);
	}

	private _testOnBorrow(): boolean {
		if (this._availableObjects.length < 1) {
			return false;
		}

		const pooledResource = this._availableObjects.shift()!;
		pooledResource.test();
		this._testOnBorrowResources.add(pooledResource);

		// TODO: revise
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
		this._dispatchPooledResourceToNextWaitingClient(pooledResource);
		return false;
	}

	private _dispense(): void {
		const numWaitingClients = this._waitingClientsQueue.length;

		if (numWaitingClients < 1) {
			return;
		}

		const resourceShortfall = numWaitingClients - this._potentiallyAllocableResourceCount;

		const actualNumberOfResourcesToCreate = Math.min(
			this.spareResourceCapacity,
			resourceShortfall,
		);
		for (let i = 0; actualNumberOfResourcesToCreate > i; i++) {
			this._createResource();
		}

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

	private _createResource(): void {
		const factoryPromise = this._factory.create();
		const wrappedFactoryPromise = this.promiseConstructor.resolve(factoryPromise).then(
			(resource) => {
				const pooledResource = new PooledResource(resource);
				this._allObjects.add(pooledResource);
				this._addPooledResourceToAvailableObjects(pooledResource);
			},
		);

		this._trackOperation(wrappedFactoryPromise, this._factoryCreateOperations)
			.then(() => {
				this._dispense();
				return null;
			})
			.catch((_reason) => {
				// TODO: handle
				// this.emit(FACTORY_CREATE_ERROR, reason);
				this._dispense();
			});
	}

	private _ensureMinimum(): void {
		if (this._draining === true) {
			return;
		}
		const minShortfall = this._config.min - this._count;
		for (let i = 0; i < minShortfall; i++) {
			this._createResource();
		}
	}

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

	private _scheduleEvictorRun(): void {
		if (this._config.evictionRunIntervalMillis > 0) {
			this._scheduledEviction = setTimeout(() => {
				this._evict();
				this._scheduleEvictorRun();
			}, this._config.evictionRunIntervalMillis).unref();
		}
	}

	private _descheduleEvictorRun(): void {
		if (this._scheduledEviction) {
			clearTimeout(this._scheduledEviction);
		}
		this._scheduledEviction = null;
	}

	start(): void {
		if (this._draining === true) {
			return;
		}
		if (this._started === true) {
			return;
		}
		this._started = true;
		this._scheduleEvictorRun();
		this._ensureMinimum();
	}

	acquire(priority?: number): Promise<any> {
		if (this._started === false && this._config.autostart === false) {
			this.start();
		}

		if (this._draining) {
			return this.promiseConstructor.reject(
				new Error('pool is draining and cannot accept work'),
			);
		}

		if (
			this.spareResourceCapacity < 1
			&& this._availableObjects.length < 1
			&& this._config.maxWaitingClients !== undefined
			&& this._waitingClientsQueue.length >= this._config.maxWaitingClients
		) {
			return this.promiseConstructor.reject(
				new Error('max waitingClients count exceeded'),
			);
		}

		const resourceRequest = new ResourceRequest<T>(
			this._config.acquireTimeoutMillis,
			this.promiseConstructor,
		);
		this._waitingClientsQueue.enqueue(resourceRequest, priority);
		this._dispense();

		return resourceRequest.promise;
	}

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

	isBorrowedResource(resource: any): boolean {
		return this._resourceLoans.has(resource);
	}

	release(resource: T): Promise<void> {
		const loan = this._resourceLoans.get(resource);

		if (loan === undefined) {
			return this.promiseConstructor.reject(
				new Error('Resource not currently part of this pool'),
			);
		}

		this._resourceLoans.delete(resource);
		// TODO: revise. was like that: "loan.resolve(resource);" I'm trying to fix it, maybe I'm wrong
		loan.resolve(resource);
		const pooledResource = loan.pooledResource;

		pooledResource.deallocate();
		this._addPooledResourceToAvailableObjects(pooledResource);

		this._dispense();
		return this.promiseConstructor.resolve();
	}

	destroy(resource: T): Promise<void> {
		const loan = this._resourceLoans.get(resource);

		if (loan === undefined) {
			return this.promiseConstructor.reject(
				new Error('Resource not currently part of this pool'),
			);
		}

		this._resourceLoans.delete(resource);
		// TODO: revise. was like that: "loan.resolve(resource);" I'm trying to fix it, maybe I'm wrong
		loan.resolve(resource);
		const pooledResource = loan.pooledResource;

		pooledResource.deallocate();
		this._destroy(pooledResource);

		this._dispense();
		return this.promiseConstructor.resolve();
	}

	private _addPooledResourceToAvailableObjects(pooledResource: PooledResource<T>): void {
		pooledResource.idle();
		if (this._config.fifo === true) {
			this._availableObjects.push(pooledResource);
		} else {
			this._availableObjects.unshift(pooledResource);
		}
	}

	async drain(): Promise<void> {
		this._draining = true;
		await this.__allResourceRequestsSettled();
		await this.__allResourcesReturned();
		this._descheduleEvictorRun();
	}

	private __allResourceRequestsSettled(): Promise<void> {
		if (this._waitingClientsQueue.length > 0) {
			return reflector(this._waitingClientsQueue.tail!.promise);
		}
		return this.promiseConstructor.resolve();
	}

	private __allResourcesReturned(): Promise<void[]> {
		const ps = [...this._resourceLoans.values()]
			.map((loan) => loan.promise)
			.map((element) => reflector(element));
		return this.promiseConstructor.all(ps);
	}

	async clear(): Promise<void> {
		const reflectedCreatePromises = [...this._factoryCreateOperations]
			.map((element) => reflector(element));

		await this.promiseConstructor.all(reflectedCreatePromises);
		for (const resource of this._availableObjects) {
			this._destroy(resource);
		}
		const reflectedDestroyPromises = [...this._factoryDestroyOperations]
			.map((element_1) => reflector(element_1));
		return await reflector(this.promiseConstructor.all(reflectedDestroyPromises));
	}

	ready(): Promise<void> {
		return new this.promiseConstructor((resolve) => {
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
