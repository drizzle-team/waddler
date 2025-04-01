import type QueryStream from 'pg-query-stream';

export interface WaddlerDriverExtension {
	/** The name of the extension. */
	name: 'WaddlerPgQueryStream';
	/** The different constructors for extension instance. */
	constructor: new(...params: any) => QueryStream;
}

export type WaddlerConfig = {
	extensions?: WaddlerDriverExtension[];
};
