import Docker from 'dockerode';
import getPort from 'get-port';
import crypto from 'node:crypto';

export const createPgDockerDB = async () => {
	const docker = new Docker();
	const port = await getPort({ port: 3306 });
	const image = 'postgres:17.3';

	const pullStream = await docker.pull(image);
	await new Promise((resolve, reject) =>
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		docker.modem.followProgress(pullStream, (err: any) => err ? reject(err) : resolve(err))
	);

	const user = 'postgres', password = 'postgres', database = 'postgres';
	const pgContainer = await docker.createContainer({
		Image: image,
		Env: [`POSTGRES_USER=${user}`, `POSTGRES_PASSWORD=${password}`, `POSTGRES_DATABASE=${database}`],
		name: `drizzle-integration-tests-${crypto.randomUUID()}`,
		HostConfig: {
			AutoRemove: true,
			PortBindings: {
				'5432/tcp': [{ HostPort: `${port}` }],
			},
		},
	});

	await pgContainer.start();

	return {
		pgContainer,
		connectionParams: {
			host: 'localhost',
			port,
			user,
			password,
			database,
			ssl: false,
		},
	};
};
