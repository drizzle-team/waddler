import QueryStream from 'pg-query-stream';
import { WaddlerDriverExtension } from '~/extensions';

export function queryStream(): WaddlerDriverExtension {
	return {
		name: 'WaddlerPgQueryStream',
		constructor: QueryStream,
	};
}
