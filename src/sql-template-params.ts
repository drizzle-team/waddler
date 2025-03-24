export abstract class SQLIdentifier {
	abstract generateSQL(): { sql: string };
}

// export type Value = string | number | bigint | boolean | Date | SQLDefault | null | Value[];
export abstract class SQLValues {
	abstract generateSQL(lastParamIdx: number): { sql: string; params?: any[] };
}

export type Raw = string | number | boolean | bigint;
export class SQLRaw {
	constructor(private readonly value: Raw) {}

	generateSQL() {
		if (
			typeof this.value === 'number'
			|| typeof this.value === 'bigint'
			|| typeof this.value === 'string'
			|| typeof this.value === 'boolean'
		) {
			return { sql: `${this.value}` };
		}

		if (typeof this.value === 'object') {
			throw new Error(
				"you can't specify array, object or null as parameter for sql.raw.",
			);
		}

		if (this.value === undefined) {
			throw new Error(
				"you can't specify undefined as parameter for sql.raw, maybe you mean using sql.default?",
			);
		}

		if (typeof this.value === 'symbol') {
			throw new Error("you can't specify symbol as parameter for sql.raw.");
		}

		throw new Error("you can't specify function as parameter for sql.raw.");
	}
}

export abstract class SQLDefault {
	abstract generateSQL(): { sql: string };
}
