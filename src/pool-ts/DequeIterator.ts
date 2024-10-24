import type { DoublyLinkedList, Node } from './DoublyLinkedList.ts';

/**
 * Thin wrapper around an underlying DDL iterator
 */
export class DequeIterator<T> implements Iterator<T> {
	private _list: DoublyLinkedList<T>;
	private _direction: 'prev' | 'next';
	private _startPosition: 'tail' | 'head';
	private _started: boolean;
	private _cursor: Node<T> | null;
	private _done: boolean;
	/**
	 * @param  {Object} deque     a node that is part of a doublyLinkedList
	 * @param  {Boolean} [reverse=false]     is this a reverse iterator? default: false
	 */
	constructor(dll: DoublyLinkedList<T>, reverse: boolean = false) {
		this._list = dll;
		// NOTE: these key names are tied to the DoublyLinkedListIterator
		this._direction = reverse === true ? 'prev' : 'next';
		this._startPosition = reverse === true ? 'tail' : 'head';
		this._started = false;
		this._cursor = null;
		this._done = false;
	}

	_start() {
		this._cursor = this._list[this._startPosition];
		this._started = true;
	}

	_advanceCursor() {
		if (this._started === false) {
			this._start();
			return;
		}
		this._cursor = this._cursor![this._direction];
	}

	reset() {
		this._done = false;
		this._started = false;
		this._cursor = null;
	}

	remove() {
		if (
			this._started === false
			|| this._done === true
			|| this._isCursorDetached()
		) {
			return false;
		}
		this._list.remove(this._cursor!);

		// TODO: revise
		return;
	}

	next(): { done: true; value: undefined } | { value: T; done?: false } {
		if (this._done === true) {
			return { done: true, value: undefined };
		}

		this._advanceCursor();

		// if there is no node at the cursor or the node at the cursor is no longer part of
		// a doubly linked list then we are done/finished/kaput
		if (this._cursor === null || this._isCursorDetached()) {
			this._done = true;
			return { done: true, value: undefined };
		}

		return {
			value: this._cursor.data,
			done: false,
		};
	}

	/**
	 * Is the node detached from a list?
	 * NOTE: you can trick/bypass/confuse this check by removing a node from one DoublyLinkedList
	 * and adding it to another.
	 * TODO: We can make this smarter by checking the direction of travel and only checking
	 * the required next/prev/head/tail rather than all of them
	 * @return {Boolean}      [description]
	 */
	_isCursorDetached() {
		return (
			this._cursor!.prev === null
			&& this._cursor!.next === null
			&& this._list.tail !== this._cursor
			&& this._list.head !== this._cursor
		);
	}
}
