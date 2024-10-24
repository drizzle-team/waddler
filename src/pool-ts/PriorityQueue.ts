import Queue from './Queue.ts';
import type ResourceRequest from './ResourceRequest.ts';

/**
 * @class
 * @private
 */
class PriorityQueue<T> {
	private _size: number;
	private _slots: Queue<ResourceRequest<T>>[];

	constructor(size: number) {
		this._size = Math.max(Math.trunc(+size), 1);
		this._slots = [];

		// Initialize arrays to hold queue elements
		for (let i = 0; i < this._size; i++) {
			this._slots.push(new Queue());
		}
	}

	get length(): number {
		let _length = 0;
		for (let i = 0, sl = this._slots.length; i < sl; i++) {
			_length += this._slots[i]!.length;
		}
		return _length;
	}

	enqueue(obj: ResourceRequest<T>, priority?: number): void {
		// Convert to integer with a default value of 0.
		priority = (priority && Math.trunc(+priority)) || 0;

		if (priority < 0 || priority >= this._size) {
			priority = this._size - 1; // Put obj at the end of the line
		}

		this._slots[priority]!.push(obj);
	}

	dequeue(): ResourceRequest<T> | null {
		// so priority equals 0 is the highest
		for (let i = 0, sl = this._slots.length; i < sl; i++) {
			if (this._slots[i]!.length > 0) {
				return this._slots[i]!.shift();
			}
		}
		return null;
	}

	get head(): ResourceRequest<T> | null {
		for (let i = 0, sl = this._slots.length; i < sl; i++) {
			if (this._slots[i]!.length > 0) {
				return this._slots[i]!.head;
			}
		}
		return null;
	}

	get tail(): ResourceRequest<T> | null {
		for (let i = this._slots.length - 1; i >= 0; i--) {
			if (this._slots[i]!.length > 0) {
				return this._slots[i]!.tail;
			}
		}
		return null;
	}
}

export default PriorityQueue;
