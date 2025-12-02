import { sql } from 'waddler/gel';

export const filter1 = ({ user_id, name, email }: { user_id?: number; name?: string; email?: string }) => {
	const filters = [];
	if (user_id) filters.push(sql`user_id = ${user_id}`);
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
