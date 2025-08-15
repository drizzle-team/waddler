import mssql from 'mssql';

export class AutoPool {
	private pool: mssql.ConnectionPool;

	constructor(config: string | mssql.config) {
		this.pool = new mssql.ConnectionPool(config as any);
	}

	async $instance() {
		await this.pool.connect().catch((err) => {
			console.error('❌ AutoPool failed to connect:', err);
			throw err;
		});
		return this.pool;
	}
}
