import { DequeIterator } from './DequeIterator.ts';
import { DoublyLinkedList, Node } from './DoublyLinkedList.ts';

/**
 * DoublyLinkedList backed double ended queue
 * implements just enough to keep the Pool
 */
export class Deque<T> {
	protected _list: DoublyLinkedList<T>;
	constructor() {
		this._list = new DoublyLinkedList<T>();
	}

	/**
	 * removes and returns the first element from the queue
	 * @return [description]
	 */
	shift() {
		if (this.length <= 0) {
			return null;
		}

		const node = this._list.head!;
		this._list.remove(node);

		return node.data;
	}

	/**
	 * adds one elemts to the beginning of the queue
	 * @param  {any} element [description]
	 * @return           [description]
	 */
	unshift(element: T) {
		const node = new Node(element);

		this._list.insertBeginning(node);
	}

	/**
	 * adds one to the end of the queue
	 * @param  {any} element [description]
	 * @return          [description]
	 */
	push(element: T) {
		const node = new Node(element);

		this._list.insertEnd(node);
	}

	/**
	 * removes and returns the last element from the queue
	 */
	pop() {
		if (this.length <= 0) {
			return null;
		}

		const node = this._list.tail!;
		this._list.remove(node);

		return node.data;
	}

	[Symbol.iterator]() {
		return new DequeIterator(this._list);
	}

	iterator() {
		return new DequeIterator(this._list);
	}

	reverseIterator() {
		return new DequeIterator(this._list, true);
	}

	/**
	 * get a reference to the item at the head of the queue
	 * @return [description]
	 */
	get head() {
		if (this.length === 0) {
			return null;
		}
		const node = this._list.head!;
		return node.data;
	}

	/**
	 * get a reference to the item at the tail of the queue
	 * @return  [description]
	 */
	get tail() {
		if (this.length === 0) {
			return null;
		}
		const node = this._list.tail!;
		return node.data;
	}

	get length() {
		return this._list.length;
	}
}
