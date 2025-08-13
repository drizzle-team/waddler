import { sql } from 'waddler/neon-http';

export const filter1 = ({ id, name, email }: { id?: number; name?: string; email?: string }) => {
	const filters = [];
	if (id) filters.push(sql`id = ${id}`);
	if (name) filters.push(sql`name = ${name}`);
	if (email) filters.push(sql`email = ${email}`);

	const finalSqlFilter = sql``;
	const sqlFiltersDelimeter = sql` and `;
	for (const [idx, filterSql] of filters.entries()) {
		finalSqlFilter.append(filterSql);
		if (idx !== filters.length - 1) finalSqlFilter.append(sqlFiltersDelimeter);
	}

	return finalSqlFilter;
};
