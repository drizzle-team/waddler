import { promisify } from 'util';

export function methodPromisify<T extends object, R>(
	methodFn: (...args: any[]) => any,
): (target: T, ...args: any[]) => Promise<R> {
	return promisify((target: T, ...args: any[]): any => methodFn.bind(target)(...args)) as any;
}
