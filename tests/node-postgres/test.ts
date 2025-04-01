import { waddler } from '~/node-postgres';
import { queryStream } from '~/node-postgres/pg-query-stream';

const sql = waddler('', { extensions: [queryStream()] });
await sql`select 1`;
