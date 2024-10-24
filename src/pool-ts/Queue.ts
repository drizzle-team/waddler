'use strict';

import Deque from './Deque.ts';
import { Node } from './DoublyLinkedList.ts';
import type ResourceRequest from './ResourceRequest.ts';

/**
 * Sort of a internal queue for holding the waiting
 * resource request for a given "priority".
 * Also handles managing timeouts rejections on items (is this the best place for this?)
 * This is the last point where we know which queue a resourceRequest is in
 */
export class Queue<T extends ResourceRequest> extends Deque<T> {
	/**
	 * Adds the obj to the end of the list for this slot
	 * we completely override the parent method because we need access to the
	 * node for our rejection handler
	 * @param {any} resourceRequest [description]
	 */
	override push(resourceRequest: T) {
		const node = new Node(resourceRequest);
		resourceRequest.promise.catch(this._createTimeoutRejectionHandler(node));
		this._list.insertEnd(node);
	}

	_createTimeoutRejectionHandler(node: Node) {
		return (reason: any) => {
			if (reason.name === 'TimeoutError') {
				this._list.remove(node);
			}
		};
	}
}

export default Queue;
