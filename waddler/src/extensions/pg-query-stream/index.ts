import QueryStream from 'pg-query-stream';
import type { WaddlerDriverExtension } from '..';

export function queryStream(): WaddlerDriverExtension {
	return {
		name: 'WaddlerPgQueryStream',
		constructor: QueryStream,
	};
}
