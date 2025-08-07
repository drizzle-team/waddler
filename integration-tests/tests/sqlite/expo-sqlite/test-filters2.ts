import * as waddlerTools from 'waddler/expo-sqlite';

export const filter2 = ({ id, name, email }: { id?: number; name?: string; email?: string }) => {
	const filters = [];
	if (id) filters.push(waddlerTools.sql`id = ${id}`);
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
