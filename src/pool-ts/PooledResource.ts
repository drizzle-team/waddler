enum PooledResourceState {
	ALLOCATED = 'ALLOCATED', // In use
	IDLE = 'IDLE', // In the queue, not in use.
	INVALID = 'INVALID', // Failed validation
	RETURNING = 'RETURNING', // Resource is in process of returning
	VALIDATION = 'VALIDATION', // Currently being tested
}

/**
 * @class
 * @private
 */
export class PooledResource<T> {
	creationTime: number;
	lastReturnTime: number | null;
	lastBorrowTime: number | null;
	lastIdleTime: number | null;
	obj: T;
	state: PooledResourceState;

	constructor(resource: T) {
		this.creationTime = Date.now();
		this.lastReturnTime = null;
		this.lastBorrowTime = null;
		this.lastIdleTime = null;
		this.obj = resource;
		this.state = PooledResourceState.IDLE;
	}

	// mark the resource as "allocated"
	allocate(): void {
		this.lastBorrowTime = Date.now();
		this.state = PooledResourceState.ALLOCATED;
	}

	// mark the resource as "deallocated"
	deallocate(): void {
		this.lastReturnTime = Date.now();
		this.state = PooledResourceState.IDLE;
	}

	invalidate(): void {
		this.state = PooledResourceState.INVALID;
	}

	test(): void {
		this.state = PooledResourceState.VALIDATION;
	}

	idle(): void {
		this.lastIdleTime = Date.now();
		this.state = PooledResourceState.IDLE;
	}

	returning(): void {
		this.state = PooledResourceState.RETURNING;
	}
}
