import type { PooledResource } from './PooledResource.ts';
import type { IEvictorConfig } from './types.ts';

export class DefaultEvictor<T> {
	evict(config: IEvictorConfig, pooledResource: PooledResource<T>, availableObjectsCount: number) {
		const idleTime = Date.now() - pooledResource.lastIdleTime!;

		if (
			config.softIdleTimeoutMillis > 0
			&& config.softIdleTimeoutMillis < idleTime
			&& config.min < availableObjectsCount
		) {
			return true;
		}

		if (config.idleTimeoutMillis < idleTime) {
			return true;
		}

		return false;
	}
}
