import type QueryStream from 'pg-query-stream';
import type { WaddlerConfig } from '../types.ts';

export interface WaddlerDriverExtension {
	/** The name of the extension. */
	name: 'WaddlerPgQueryStream';
	/** The different constructors for extension instance. */
	constructor: new(...params: any) => QueryStream;
}

export type WaddlerConfigWithExtensions = {
	extensions?: WaddlerDriverExtension[];
} & WaddlerConfig;
