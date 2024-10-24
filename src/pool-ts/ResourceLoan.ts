import Deferred from './Deferred.ts';
import type PooledResource from './PooledResource.ts';

/**
 * Plan is to maybe add tracking via Error objects
 * and other fun stuff!
 */
class ResourceLoan<T> extends Deferred<T> {
	private _creationTimestamp: number;
	pooledResource: PooledResource<T>;

	/**
	 * @param {any} pooledResource the PooledResource this loan belongs to
	 * @param {PromiseConstructor} promiseConstructor promise implementation
	 */
	constructor(pooledResource: any, promiseConstructor: PromiseConstructor) {
		super(promiseConstructor);
		this._creationTimestamp = Date.now();
		this.pooledResource = pooledResource;
	}

	override reject(): void {
		/**
		 * Loans can only be resolved at the moment
		 */
	}
}

export default ResourceLoan;
