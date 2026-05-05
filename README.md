# Waddler 🦆
<a href="https://waddler.drizzle.team">Website</a> •
  <a href="https://waddler.drizzle.team/docs/overview">Documentation</a> •
  <a href="https://x.com/drizzleorm">Twitter</a> • by [Drizzle Team](https://drizzle.team)  
  
Waddler - is a thin SQL client wrapper with modern API inspired by [`postgresjs`](https://github.com/porsager/postgres) and based on ES6 Tagged Template Strings.

> You don't need to learn an api for db clients; just use the `sql` template tag for everything

Waddler is our vision of a modern, all-in-one client for any database dialect.
It doesn't perform any specific mappings to or from a database, doesn't handle complex query building, and doesn't parse queries.
Waddler simply unifies communication with your database using any client you 
choose - whether it's a simple TCP connection or an HTTP-based DB client.

We support all the dialects and drivers that [Drizzle](https://orm.drizzle.team/docs/get-started) supports

You can check a full list of clients you can use - [here](/docs/get-started)

```ts
import { waddler } from "waddler/node-postgres";
import { waddler } from "waddler/mysql2";
import { waddler } from "waddler/libsql";

const sql = waddler({ dbUrl: process.env.DB_URL });
const sql = waddler();

// promisified SQL template API
const result = await sql`select * from users`;

// Easy to use values param
const values = sql.values([["Dan", "dan@acme.com", 25]]);
await sql`insert into "users" ("name", "email", "age") values ${values}`;
// insert into "users" ("name", "email", "age") values ('Dan', 'dan@acme.com', 25);

// no SQL injections
await sql`select * from users where id = ${10}`; // <-- converts to $1 and [10] params
  
// waddler supports types
await sql<{ id: number, name: string }>`select * from users`;

// streaming and chunking
const stream = sql`select * from users`.stream();
for await (const row of stream) {
  console.log(row);
}

const chunked = sql`select * from users`.chunked(2);
for await (const chunk of chunked) {
  console.log(chunk);
}
```

You can enable logger with all the metadata coming from drivers
```ts
import { Logger } from 'waddler';
import { waddler } from 'waddler/...'; // driver specific
class MyLogger implements Logger {
  logQuery(query: string, params: unknown[], metadata?: any): void {
    // metadata will contain all the extra fields coming from the specific db driver
    console.log({ query, params, metadata });
  }
}
const db = waddler({ logger: new MyLogger() });
```

For more information you can check the [docs](https://waddler.drizzle.team/docs/overview)