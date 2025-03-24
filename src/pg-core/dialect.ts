import type { IdentifierObject } from "~/node-postgres/sql-template-params";
import { SQLIdentifier } from "~/sql-template-params.ts";

export class NodePgSQLIdentifier extends SQLIdentifier<IdentifierObject> {
  override escapeParam(num: number): string {
    return `$${num}`;
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
