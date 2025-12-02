import * as waddlerTools from 'waddler/gel';

export const filter2 = ({ user_id, name, email }: { user_id?: number; name?: string; email?: string }) => {
	const filters = [];
	if (user_id) filters.push(waddlerTools.sql`user_id = ${user_id}`);
	if (name) filters.push(waddlerTools.sql`name = ${name}`);
	if (email) filters.push(waddlerTools.sql`email = ${email}`);

	const finalSqlFilter = waddlerTools.sql``;
	const sqlFiltersDelimeter = waddlerTools.sql` and `;
	for (const [idx, filterSql] of filters.entries()) {
		finalSqlFilter.append(filterSql);
		if (idx !== filters.length - 1) finalSqlFilter.append(sqlFiltersDelimeter);
	}

	return finalSqlFilter;
};
