import { expect, test } from 'vitest';
import { waddler } from '../../src/duckdb-neo/index.ts';

test('error during connection test', async () => {
	const sql = waddler({ url: 'md:?motherduck_token=test', max: 10, accessMode: 'read_write' });

	// sql template case
	await expect(sql`select 1;`).rejects.toThrow(
		/^Invalid Input Error: Initialization function "motherduck_init"../,
	);

	// sql.unsafe case
	await expect(sql.unsafe('select 1;')).rejects.toThrow(
		/^Invalid Input Error: Initialization function "motherduck_init"../,
	);
});
