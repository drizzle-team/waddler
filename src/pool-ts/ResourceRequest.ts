import Deferred from './Deferred.ts';
import { TimeoutError } from './errors.ts';

function fbind(fn: () => void, ctx: any) {
	return function bound() {
		return fn.apply(ctx);
	};
}

/**
 * Wraps a user's request for a resource
 * Basically a promise mashed in with a timeout
 * @private
 */
class ResourceRequest<T> extends Deferred<T> {
	private _creationTimestamp: number;
	private _timeout: NodeJS.Timeout | null;

	/**
	 * [constructor description]
	 * @param  {number} ttl timeout in milliseconds
	 * @param  {PromiseConstructor} promiseConstructor promise implementation
	 */
	constructor(ttl: number | undefined, promiseConstructor: PromiseConstructor) {
		super(promiseConstructor);
		this._creationTimestamp = Date.now();
		this._timeout = null;

		if (ttl !== undefined) {
			this.setTimeout(ttl);
		}
	}

	setTimeout(delay: number): void {
		if (this._state !== ResourceRequest.PENDING) {
			return;
		}
		const ttl = Number.parseInt(delay.toString(), 10);

		if (Number.isNaN(ttl) || ttl <= 0) {
			throw new Error('delay must be a positive int');
		}

		const age = Date.now() - this._creationTimestamp;

		if (this._timeout) {
			this.removeTimeout();
		}

		this._timeout = setTimeout(
			fbind(this._fireTimeout, this),
			Math.max(ttl - age, 0),
		);
	}

	removeTimeout(): void {
		if (this._timeout) {
			clearTimeout(this._timeout);
		}
		this._timeout = null;
	}

	private _fireTimeout(): void {
		this.reject(new TimeoutError('ResourceRequest timed out'));
	}

	override reject(reason?: any): void {
		this.removeTimeout();
		super.reject(reason);
	}

	override resolve(value: T): void {
		this.removeTimeout();
		super.resolve(value);
	}
}

export default ResourceRequest;
