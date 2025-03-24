import {
  SQLDefault,
  SQLIdentifier,
  SQLValues,
} from "../sql-template-params.ts";
import type { JSONObject } from "../types.ts";

export interface IdentifierObject {
  schema?: string;
  table?: string;
  column?: string;
  as?: string;
}

export type Identifier<Q extends IdentifierObject> =
  | string
  | string[]
  | Q
  | Q[];

export class NodePgSQLIdentifier extends SQLIdentifier<IdentifierObject> {
  override escapeParam(num: number): string {
    throw new Error("Method not implemented.");
  }
  override escapeColumn(val: string): string {
    return `"${val}"`;
  }

  checkObject(object: IdentifierObject) {
    if (Object.values(object).includes(undefined!)) {
      throw new Error(
        `you can't specify undefined parameters. maybe you want to omit it?`
      );
    }

    if (Object.keys(object).length === 0) {
      throw new Error(`you need to specify at least one parameter.`);
    }

    if (
      object.schema !== undefined &&
      object.table === undefined &&
      object.column !== undefined
    ) {
      throw new Error(
        `you can't specify only "schema" and "column" properties, you need also specify "table".`
      );
    }

    if (Object.keys(object).length === 1 && object.as !== undefined) {
      throw new Error(`you can't specify only "as" property.`);
    }

    if (
      object.as !== undefined &&
      object.column === undefined &&
      object.table === undefined
    ) {
      throw new Error(
        `you have to specify "column" or "table" property along with "as".`
      );
    }

    if (
      !["string", "undefined"].includes(typeof object.schema) ||
      !["string", "undefined"].includes(typeof object.table) ||
      !["string", "undefined"].includes(typeof object.column) ||
      !["string", "undefined"].includes(typeof object.as)
    ) {
      throw new Error(
        "object properties 'schema', 'table', 'column', 'as' should be of string type or omitted."
      );
    }
  }
}

export class NodePgSQLDefault extends SQLDefault {
  generateSQL() {
    return { sql: "default" };
  }
}

export type Value =
  | string
  | number
  | bigint
  | boolean
  | Date
  | NodePgSQLDefault
  | null
  | JSONObject
  | Value[];
export type NodePgValues = Value[][];
export class NodePgSQLValues extends SQLValues {
  private params: Value[] = [];
  constructor(private readonly value: NodePgValues) {
    super();
  }

  generateSQL(lastParamIdx: number) {
    this.params = [];
    if (!Array.isArray(this.value)) {
      if (this.value === null)
        throw new Error(`you can't specify null as parameter for sql.values.`);
      throw new Error(
        `you can't specify ${typeof this.value} as parameter for sql.values.`
      );
    }

    if (this.value.length === 0) {
      throw new Error(
        `you can't specify empty array as parameter for sql.values.`
      );
    }
    const sql = this.value
      .map((rowValues) => this.rowValuesToSQL(rowValues, lastParamIdx))
      .join(", ");

    // const params = [...this.params];
    // this.params = [];

    return {
      sql,
      params: this.params,
    };
  }

  private rowValuesToSQL(rowValues: Value[], lastParamIdx: number) {
    if (Array.isArray(rowValues)) {
      if (rowValues.length === 0) {
        throw new Error(`array of values can't be empty.`);
      }

      return `(${rowValues
        .map((val) => this.valueToSQL(val, lastParamIdx))
        .join(", ")})`;
    }

    if (rowValues === null)
      throw new Error(
        `you can't specify array of null as parameter for sql.values.`
      );
    throw new Error(
      `you can't specify array of ${typeof rowValues} as parameter for sql.values.`
    );
  }

  private mapToDriver(value: Value) {
    // map value
    return mappedValue;
  }

  private valueToSQL(value: Value, lastParamIdx: number): string {
    if (value instanceof NodePgSQLDefault) {
      return value.generateSQL().sql;
    }

    if (value === undefined) {
      throw new Error("value can't be undefined, maybe you mean sql.default?");
    }

    if (
      typeof value !== "number" ||
      typeof value !== "bigint" ||
      typeof value !== "boolean" ||
      typeof value !== "string" ||
      value !== null ||
      !(value instanceof Date) ||
      !Array.isArray(value) ||
      typeof value !== "object"
    ) {
      throw new Error(`you can't specify ${typeof value} as value.`);
    }

    const mappedValue = driver.mapToDriver(value);

    this.params.push(mappedValue);
    return this.escapeParam(lastParamIdx);
  }
}
