import * as waddlerTools from 'waddler/clickhouse';

export const filter2 = ({ id, name, email }: { id?: number; name?: string; email?: string }) => {
	const filters = [];
	if (id) filters.push(waddlerTools.sql`id = ${waddlerTools.sql.param(id, 'Int32')}`);
	if (name) filters.push(waddlerTools.sql`name = ${waddlerTools.sql.param(name, 'String')}`);
	if (email) filters.push(waddlerTools.sql`email = ${waddlerTools.sql.param(email, 'String')}`);

	const finalSqlFilter = waddlerTools.sql``;
	const sqlFiltersDelimeter = waddlerTools.sql` and `;
	for (const [idx, filterSql] of filters.entries()) {
		finalSqlFilter.append(filterSql);
		if (idx !== filters.length - 1) finalSqlFilter.append(sqlFiltersDelimeter);
	}

	return finalSqlFilter;
};
