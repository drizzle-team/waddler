interface Factory<T> {
	create(): Promise<T>;
	destroy(connection: T): Promise<void>;
	validate?(connection: T): Promise<boolean>;
}

export default function validateFactory<T = unknown>(factory: Factory<T>): void {
	if (typeof factory.create !== 'function') {
		throw new TypeError('factory.create must be a function');
	}

	if (typeof factory.destroy !== 'function') {
		throw new TypeError('factory.destroy must be a function');
	}

	if (factory.validate !== undefined && typeof factory.validate !== 'function') {
		throw new TypeError('factory.validate must be a function');
	}
}
