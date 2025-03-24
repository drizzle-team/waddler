import type {
  IdentifierObject,
  Identifier,
} from "./node-postgres/sql-template-params.ts";

export abstract class SQLIdentifier<Q extends IdentifierObject> {
  constructor(private readonly value: Identifier<Q>) {}

  abstract escapeColumn(val: string): string;
  abstract escapeParam(num: number): string;
  abstract checkObject(val: Q): void;

  objectToSQL(object: Q) {
    this.checkObject(object);

    const schema = object.schema === undefined ? "" : `"${object.schema}".`;
    const table = object.table === undefined ? "" : `"${object.table}"`;
    const column = object.column === undefined ? "" : `."${object.column}"`;
    const as = object.as === undefined ? "" : ` as "${object.as}"`;

    return `${schema}${table}${column}${as}`.replace(/^\.|\.$/g, "");
  }

  generateSQL() {
    if (typeof this.value === "string") {
      return {
        sql: `${this.escapeColumn(this.value)}`,
      };
    }

    if (Array.isArray(this.value)) {
      if (this.value.length === 0) {
        throw new Error(
          `you can't specify empty array as parameter for sql.identifier.`
        );
      }

      const chunks: string[] = [];

      for (const val of this.value) {
        if (Array.isArray(val)) {
          throw new Error(
            `you can't specify array of arrays as parameter for sql.identifier.`
          );
        }
        if (typeof val === "string") {
          chunks.push(this.escapeColumn(val));
        } else if (typeof val === "object" && val !== null) {
          chunks.push(this.objectToSQL(val));
        } else {
          throw new Error(
            `you can't specify array of (null or undefined or number or bigint or boolean or symbol or function) as parameter for sql.identifier.`
          );
        }
      }

      return { sql: chunks.join(",") };
    }

    if (typeof this.value === "object" && this.value !== null) {
      return { sql: this.objectToSQL(this.value) };
    }

    if (this.value === null) {
      throw new Error(
        `you can't specify null as parameter for sql.identifier.`
      );
    }

    throw new Error(
      `you can't specify ${typeof this.value} as parameter for sql.identifier.`
    );
  }
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
      typeof this.value === "number" ||
      typeof this.value === "bigint" ||
      typeof this.value === "string" ||
      typeof this.value === "boolean"
    ) {
      return { sql: `${this.value}` };
    }

    if (typeof this.value === "object") {
      throw new Error(
        "you can't specify array, object or null as parameter for sql.raw."
      );
    }

    if (this.value === undefined) {
      throw new Error(
        "you can't specify undefined as parameter for sql.raw, maybe you mean using sql.default?"
      );
    }

    if (typeof this.value === "symbol") {
      throw new Error("you can't specify symbol as parameter for sql.raw.");
    }

    throw new Error("you can't specify function as parameter for sql.raw.");
  }
}

export abstract class SQLDefault {
  abstract generateSQL(): { sql: string };
}
