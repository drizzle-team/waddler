import { type Client, type Config, createClient } from '@libsql/client/web';
import { isConfig } from '../../../utils.ts';
import { SqliteDialect } from '../../sqlite-core/dialect.ts';
import { createSqlTemplate } from '../driver-core.ts';

export function waddler<
	TClient extends Client = Client,
>(
	...params: [
		string,
	] | [
		(
			({
				connection: string | Config;
			} | {
				client: TClient;
			})
		),
	]
) {
	const dialect = new SqliteDialect();
	if (typeof params[0] === 'string') {
		const instance = createClient({
			url: params[0],
		});

		return createSqlTemplate(instance, dialect);
	}

	if (isConfig(params[0])) {
		const { connection, client } = params[0] as { connection?: Config; client?: TClient };

		if (client) return createSqlTemplate(client, dialect);

		const instance = typeof connection === 'string' ? createClient({ url: connection }) : createClient(connection!);

		return createSqlTemplate(instance, dialect);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
