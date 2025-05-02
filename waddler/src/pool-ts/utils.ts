function noop(): void {}

/**
 * Reflects a promise but does not expose any
 * underlying value or rejection from that promise.
 * @param  {Promise<any>} promise - The promise to reflect.
 * @return {Promise<void>}         - A promise that resolves after the input promise settles without exposing its result.
 */
export function reflector(promise: Promise<any>): Promise<void> {
	return promise.then(noop, noop);
}
