import { SQLValuesDriver } from '../pg-core/dialect.ts';

export class NodePgSQLValuesDriver extends SQLValuesDriver {
	override mapToDriver(value: any) {
		return value;
	}
}
