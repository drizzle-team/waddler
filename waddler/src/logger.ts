export interface Logger {
	logQuery(query: string, params: unknown[] | Record<string, unknown>, metadata?: any): void;
}

export interface LogWriter {
	write(message: string): void;
}

export class ConsoleLogWriter implements LogWriter {
	write(message: string) {
		console.log(message);
	}
}

export class DefaultLogger implements Logger {
	readonly writer: LogWriter;

	constructor(config?: { writer: LogWriter }) {
		this.writer = config?.writer ?? new ConsoleLogWriter();
	}

	logQuery(query: string, params: unknown[] | Record<string, unknown>, metadata?: any): void {
		let paramsStr: string = '';
		if (Array.isArray(params)) {
			const stringifiedParams = params.map((p) => {
				try {
					return JSON.stringify(p);
				} catch {
					return String(p);
				}
			});
			paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(', ')}]` : '';
		} else {
			const stringifiedParams: Record<string, unknown> = {};
			let paramsCount: number = 0;

			for (const [key, value] of Object.entries(params)) {
				try {
					stringifiedParams[key] = JSON.stringify(value);
					paramsCount++;
				} catch {
					stringifiedParams[key] = String(value);
					paramsCount++;
				}
			}
			paramsStr = paramsCount ? ` -- params: ${JSON.stringify(stringifiedParams)}` : '';
		}

		const metadataStr = metadata === undefined ? '' : ` --metadata: ${JSON.stringify(metadata)}`;

		this.writer.write(`Query: ${query}${paramsStr}${metadataStr}`);
	}
}

export class NoopLogger implements Logger {
	logQuery(): void {
		// noop
	}
}
