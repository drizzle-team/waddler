import { type Client, type Config, createClient } from '@libsql/client-wasm';
import type { WaddlerConfig } from '~/types.ts';
import { isConfig } from '../../../utils.ts';
import { createSqlTemplate } from '../driver-core.ts';

export function waddler<
	TClient extends Client = Client,
>(
	...params: [
		string,
	] | [
		string,
		WaddlerConfig,
	] | [
		(
			& WaddlerConfig
			& ({
				connection: string | Config;
			} | {
				client: TClient;
			})
		),
	]
) {
	if (typeof params[0] === 'string') {
		const instance = createClient({
			url: params[0],
		});

		return createSqlTemplate(instance, params[1]);
	}

	if (isConfig(params[0])) {
		const { connection, client, ...configOptions } =
			params[0] as ({ connection?: Config; client?: TClient } & WaddlerConfig);

		if (client) return createSqlTemplate(client, configOptions);

		const instance = typeof connection === 'string' ? createClient({ url: connection }) : createClient(connection!);

		return createSqlTemplate(instance, configOptions);
	}

	// TODO make error more descriptive
	throw new Error(
		'Invalid parameter for waddler.',
	);
}
