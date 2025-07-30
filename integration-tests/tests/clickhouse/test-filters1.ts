import { sql } from 'waddler/clickhouse';

export const filter = ({ id, name, email }: { id?: number; name?: string; email?: string }) => {
	const filters = [];
	if (id) filters.push(sql`id = ${sql.param(id, 'Int32')}`);
	if (name) filters.push(sql`name = ${sql.param(name, 'String')}`);
	if (email) filters.push(sql`email = ${sql.param(email, 'String')}`);

	const finalSqlFilter = sql``;
	const sqlFiltersDelimeter = sql` and `;
	for (const [idx, filterSql] of filters.entries()) {
		finalSqlFilter.append(filterSql);
		if (idx !== filters.length - 1) finalSqlFilter.append(sqlFiltersDelimeter);
	}

	return finalSqlFilter;
};
