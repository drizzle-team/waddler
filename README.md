# Waddler 🦆
<a href="https://waddler.drizzle.team">Website</a> •
  <a href="https://waddler.drizzle.team/docs/overview">Documentation</a> •
  <a href="https://x.com/drizzleorm">Twitter</a> • by [Drizzle Team](https://drizzle.team)  
  
Waddler is a thin SQL client on top of official DuckDB NodeJS driver with modern API inspired by `postgresjs` and based on ES6 Tagged Template Strings.

Waddler has a baked in database pooling which unlocks full potential of hosted DuckDB services like MotherDuck. It does create multiple database instances under the hood and lets you concurrently fetch data from the remote MotherDuck database.

```ts
import { waddler } from "waddler";

const sql = waddler({ dbUrl: ":memory:" });
const sql = waddler({ dbUrl: "file.db" });
const sql = waddler({ dbUrl: "md?:" }); // mother duck url
const sql = waddler({ dbUrl: "md?:", min: 1, max: 8 }); // automatic database pooling

// promisified SQL template API
const result = await sql`select * from users`;

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

// and many more, checkout at waddler.drizzle.team
```
