import Docker from 'dockerode';
import getPort from 'get-port';
import type { config } from 'mssql';
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
	const image = 'clickhouse/clickhouse-server:25.7.4-alpine';

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

export async function createCockroachDockerDB() {
	const docker = new Docker();
	const port = await getPort({ port: 26257 });
	const image = 'cockroachdb/cockroach:v25.2.0';

	const pullStream = await docker.pull(image);
	await new Promise((resolve, reject) =>
		docker.modem.followProgress(pullStream, (err) => (err ? reject(err) : resolve(err)))
	);

	const cockroachdbContainer = await docker.createContainer({
		Image: image,
		Cmd: ['start-single-node', '--insecure'],
		name: `drizzle-integration-tests-${crypto.randomUUID()}`,
		HostConfig: {
			AutoRemove: true,
			PortBindings: {
				'26257/tcp': [{ HostPort: `${port}` }],
			},
		},
	});

	await cockroachdbContainer.start();
	const host = '127.0.0.1', user = 'root', password = undefined, database = 'defaultdb', ssl = false;

	return {
		connectionString: `postgresql://${user}@${host}:${port}/${database}${ssl ? '' : '?sslmode=disable'}`,
		connectionParams: { user, password, host, port, database, ssl },
		container: cockroachdbContainer,
	};
}

export async function createMsSqlDockerDB(suffix?: string): Promise<
	{ container: Docker.Container; options: config; connectionString: string }
> {
	const docker = new Docker();
	const port1433 = await getPort();
	// const port1431 = await getPort();
	const image = 'mcr.microsoft.com/azure-sql-edge';

	const pullStream = await docker.pull(image); // { platform: 'linux/amd64' });
	await new Promise((resolve, reject) =>
		docker.modem.followProgress(pullStream, (err) => (err ? reject(err) : resolve(err)))
	);

	const password = 'drizzle123PASSWORD!';
	const createOptions: Docker.ContainerCreateOptions = {
		Image: image,
		// platform: 'linux/amd64',
		Env: ['ACCEPT_EULA=1', `MSSQL_SA_PASSWORD=${password}`], // , 'MSSQL_TCP_PORT=1433'],
		name: `drizzle-seed-tests-${suffix}-${crypto.randomUUID()}`,
		// ExposedPorts: { '1433/tcp': {}, '1431/tcp': {} },
		HostConfig: {
			AutoRemove: true,
			PortBindings: {
				'1433/tcp': [{ HostPort: `${port1433}` }],
			},
			// CapAdd: ['SYS_PTRACE'],
		},
	};

	// createOptions.Platform = 'linux/amd64';

	const mssqlContainer = await docker.createContainer(createOptions);

	await mssqlContainer.start();

	const options: config = {
		server: 'localhost',
		port: port1433,
		database: 'master',
		user: 'SA',
		password,
		pool: {
			max: 1,
		},
		options: {
			requestTimeout: 100_000,
			encrypt: true, // for azure
			trustServerCertificate: true,
		},
	};

	const connectionString =
		`Server=${options.server},${options.port};Database=${options.database};User Id=${options.user};Password=${options.password};Encrypt=${
			options.options!.encrypt
		};TrustServerCertificate=${options.options!.trustServerCertificate};`;

	return {
		options,
		connectionString,
		container: mssqlContainer,
	};
}

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

export function parseEWKB(hex: string): [number, number] {
	const bytes = hexToBytes(hex);

	let offset = 0;

	// Byte order: 1 is little-endian, 0 is big-endian
	const byteOrder = bytes[offset];
	offset += 1;

	const view = new DataView(bytes.buffer);
	const geomType = view.getUint32(offset, byteOrder === 1);
	offset += 4;

	let _srid: number | undefined;
	if (geomType & 0x20000000) { // SRID flag
		_srid = view.getUint32(offset, byteOrder === 1);
		offset += 4;
	}

	if ((geomType & 0xFFFF) === 1) {
		const x = bytesToFloat64(bytes, offset);
		offset += 8;
		const y = bytesToFloat64(bytes, offset);
		offset += 8;

		return [x, y];
	}

	throw new Error('Unsupported geometry type');
}

function hexToBytes(hex: string): Uint8Array {
	const bytes: number[] = [];
	for (let c = 0; c < hex.length; c += 2) {
		bytes.push(Number.parseInt(hex.slice(c, c + 2), 16));
	}
	return new Uint8Array(bytes);
}

function bytesToFloat64(bytes: Uint8Array, offset: number): number {
	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	for (let i = 0; i < 8; i++) {
		view.setUint8(i, bytes[offset + i]!);
	}
	return view.getFloat64(0, true);
}
