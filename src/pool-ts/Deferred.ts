/**
 * This is apparently a bit like a Jquery deferred, hence the name
 */

export class Deferred<T> {
	static readonly PENDING = 'PENDING';
	static readonly FULFILLED = 'FULFILLED';
	static readonly REJECTED = 'REJECTED';

	protected _state: 'PENDING' | 'FULFILLED' | 'REJECTED';
	private _resolve: ((value: T | PromiseLike<T>) => void) | undefined;
	private _reject: ((reason?: any) => void) | undefined;
	private _promise: Promise<T>;

	constructor(promiseConstructor: PromiseConstructor) {
		this._state = Deferred.PENDING;

		this._promise = new promiseConstructor((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	get state() {
		return this._state;
	}

	get promise() {
		return this._promise;
	}

	reject(reason: any) {
		if (this._state !== Deferred.PENDING) {
			return;
		}
		this._state = Deferred.REJECTED;
		this._reject!(reason);
	}

	resolve(value: T) {
		if (this._state !== Deferred.PENDING) {
			return;
		}
		this._state = Deferred.FULFILLED;
		this._resolve!(value);
	}
}
