import Docker from 'dockerode';
import getPort from 'get-port';
import crypto from 'node:crypto';
import { expect } from 'vitest';

export const createPgDockerDB = async () => {
	const docker = new Docker();
	const port = await getPort();
	const image = 'postgres:17.3';

	const pullStream = await docker.pull(image);
	await new Promise((resolve, reject) =>
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

export const createMysqlDockerDB = async () => {
	const docker = new Docker();
	const port = await getPort();
	const image = 'mysql:8';

	const pullStream = await docker.pull(image);
	await new Promise((resolve, reject) =>
		docker.modem.followProgress(pullStream, (err) => err ? reject(err) : resolve(err))
	);

	const password = 'mysql', database = 'public';
	const mysqlContainer = await docker.createContainer({
		Image: image,
		Env: [`MYSQL_ROOT_PASSWORD=${password}`, `MYSQL_DATABASE=${database}`],
		name: `drizzle-integration-tests-${crypto.randomUUID()}`,
		HostConfig: {
			AutoRemove: true,
			PortBindings: {
				'3306/tcp': [{ HostPort: `${port}` }],
			},
		},
	});

	await mysqlContainer.start();

	return {
		mysqlContainer,
		connectionParams: {
			host: 'localhost',
			port,
			user: 'root',
			password,
			database,
		},
	};
};

export const createGelDockerDB = async () => {
	const docker = new Docker();
	const port = await getPort();
	const image = 'geldata/gel:6.5';
	const tlsSecurity = '--tls-security=insecure';

	const pullStream = await docker.pull(image);
	await new Promise((resolve, reject) =>
		docker.modem.followProgress(pullStream, (err) => (err ? reject(err) : resolve(err)))
	);

	const database = 'main', password = 'password';
	const connectionString = `gel://admin:${password}@localhost:${port}/${database}`;
	const gelContainer = await docker.createContainer({
		Image: image,
		Env: [
			'GEL_CLIENT_SECURITY=insecure_dev_mode',
			'GEL_SERVER_SECURITY=insecure_dev_mode',
			'GEL_CLIENT_TLS_SECURITY=no_host_verification',
			`GEL_SERVER_PASSWORD=${password}`,
		],
		name: `drizzle-integration-tests-${crypto.randomUUID()}`,
		HostConfig: {
			AutoRemove: true,
			PortBindings: {
				'5656/tcp': [{ HostPort: `${port}` }],
			},
		},
		Healthcheck: {
			Test: ['CMD-SHELL', `gel query "select 1;" ${tlsSecurity} --dsn=${connectionString}}`],
			Interval: 1000000000, // 1 second, in nanoseconds
			Retries: 7,
		},
	});

	await gelContainer.start();

	return {
		connectionString,
		connectionParams: {
			host: 'localhost',
			port,
			user: 'admin',
			password,
			database,
		},
		gelContainer,
	};
};

export const createClickHouseDockerDB = async () => {
	const docker = new Docker();
	const port = await getPort();
	const image = 'clickhouse/clickhouse-server:latest';

	const pullStream = await docker.pull(image);
	await new Promise((resolve, reject) =>
		docker.modem.followProgress(pullStream, (err) => err ? reject(err) : resolve(err))
	);

	const password = 'password', database = 'default';
	const clickHouseContainer = await docker.createContainer({
		Image: image,
		Env: [`CLICKHOUSE_PASSWORD=${password}`, `CLICKHOUSE_DATABASE=${database}`],
		name: `drizzle-integration-tests-${crypto.randomUUID()}`,
		HostConfig: {
			AutoRemove: true,
			PortBindings: {
				'8123/tcp': [{ HostPort: `${port}` }],
			},
		},
	});

	await clickHouseContainer.start();

	return {
		clickHouseContainer,
		connectionParams: {
			url: `http://localhost:${port}`,
			host: 'localhost',
			port,
			user: 'default',
			password,
			database,
		},
	};
};

const isValidDate = (date: any): boolean => {
	if (Array.isArray(date)) {
		return date.every((dateI) => isValidDate(dateI));
	}

	return date instanceof Date
		|| (typeof date === 'string' && !Number.isNaN(Date.parse(date)));
};

export const vitestExpectSoftDate = (value: any, expectedValue: any) => {
	let areValuesEqual = true;
	try {
		expect(value).toStrictEqual(expectedValue);
	} catch (error) {
		areValuesEqual = false;
		areValuesEqual = areValuesEqual
			|| isValidDate(value);
		if (!areValuesEqual) throw error;
	}

	return areValuesEqual;
};
