import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

export interface DuckDBConnectionObj {
	instance: DuckDBInstance;
	connection: DuckDBConnection;
}
