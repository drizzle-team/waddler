# Waddler

## Getting started

## Installation

```
$ npm install waddler
```

## Usage

Create your `sql` database instance

```ts
// db.ts
import { waddler } from "waddler";

const sql = waddler({
  dbUrl: "./db",
  min: 1,
  max: 10,
  accessMode: "read_write",
});

export default sql;
```

```ts
// test.ts
import sql from "./db.ts";

async function getUsersOlderThan(age: number) {
  // age = 20
  const users = await sql`
		select ${sql.identifier([
      { column: "name", as: "user_name" },
      { column: "age", as: "user_age" },
    ])}
		from ${sql.identifier({ schema: "main", table: "users" })}
		where age > ${age};
	`;

  // users = [ { user_name: 'Alex', user_age: 21 } ]
  return users;
}

async function insertUsers(values: (string | number)[][]) {
  // values = [[1, "Oleksii", 20], [2, "Alex", 23]];
  const users = await sql`
		insert into ${sql.identifier({
      schema: "main",
      table: "users",
    })} (id, name, age)
		values ${sql.values(values)}
		returning name, age;
	`;

  // users = [ { name: 'Oleksii', age: 20 }, { name: 'Alex', age: 23 } ]
  return users;
}
```

## Connection

`waddler([options])`

```ts
const sql = waddler({
  dbUrl: "./db", // url connection string to your local or remote database
  min: 1, // minimum number of connections in the pool
  max: 10, // maximum number of connections in the pool
  accessMode: "read_write", // access mode you would like to establish within all connections; can be "read_write" or "read_only"
});
```

## Queries

```
const query = sql`...`;
await query;
```

You can execute query by awaiting it.

Waddler utilizes [Tagged template function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) and gains the benefits of using tagged template literals by giving the ` sql``  ` function powerful utility.

`sql` object have several functions that can be put in ` sql``  ` function as template parameter:

- `sql.identifier`
- `sql.values`
- `sql.raw`

## Query parameters

```ts
const name = "Al",
  age = 23;

const users = await sql`
		select name, age
		from users
		where age >= ${age}
    and name like ${name + "%"};
	`;

// Which results in query:
// select name, age from users where age >= $1 and name like $2;
// and parameters: [23, "Al%"]

//  users = [{ name: 'Alex', age: 23 }]
```

## Dynamic column selection

```ts
const columns = ["name", "age"];
await sql`select ${sql.identifier(columns)} from users;`;

// Which results in query: select "name", "age" from users;
```

```ts
const columns = [
  { table: "users", column: "name", as: "user_name" },
  { table: "users", column: "age", as: "user_age" },
];

await sql`select ${sql.identifier(columns)} from users;`;

// Which results in query:
// select
// "users"."name" as "user_name",
// "users"."age" as "user_age"
// from users;
```

## Dynamic inserts

```ts
const columns = ["id", "name", "age"];
const values = [
  [1, "Oleksii", 20],
  [2, "Alex", 23],
];

await sql`
		insert into users (${sql.identifier(columns)})
		values ${sql.values(values)}
		returning ${sql.identifier(columns)};
	`;

// Which results in query:
// insert into users ("id", "name", "age")
// values (1, 'Oleksii', 20), (2, 'Alex', 23)
// returning "id", "name", "age";
```

You can provide `sql.default` property as value to `sql.values` method.

```ts
const columns = ["id", "name", "age"];
const values = [
  [1, "Oleksii", 20],
  [sql.default, "Alex", 23],
];

await sql`
		insert into users (${sql.identifier(columns)})
		values ${sql.values(values)};
	`;

// Which results in query:
// insert into users ("id", "name", "age")
// values (1, 'Oleksii', 20), (default, 'Alex', 23);
```

## Dynamic updates

```ts
const name = "Andrey";
const age = "24";
const id = 1;

await sql`
    update users 
    set name = ${name}, age = ${age} 
    where id = ${id};
`;

// Which results in query:
// update users set name = $1, age = $2 where id = $3;
```

## Table names

```ts
const table = "users";

await sql`select name, age from ${sql.identifier(table)};`;

// Which results in query: select name, age from "users";
```

```ts
const table = { schema: "main", table: "users" };

await sql`select name, age from ${sql.identifier(table)};`;

// Which results in query: select name, age from "main"."users";
```

## `sql.raw` function

Be wary of sql injections.

```ts
const schema = "main";
const table = "users";

await sql`select * from ${sql.raw(`${schema}.${table}`)};`;
```

## Returning Types

You can provide ` sql``  ` function with generic type.

```ts
const users = await sql<{ name: string; age: number }>`
    select name, age 
    from users;
`;

// type of users: {name: string; age: number}[]
```

Note: It is not about data validation.

## Data streaming

You can stream data one of the following ways:

- using `` sql`...`.stream `` function

if you want to obtain rows one by one

```ts
// type of asyncGen: AsyncGenerator<{name: string; age: number}, void, unknown>
const asyncGen = sql<{ name: string; age: number }>`
    select name,age 
    from users;
`.stream();

for await (const row of asyncGen) {
  // type of row: {name: string; age: number}
  console.log(row);
}
```

- using `` sql`...`.chunked([chunkSize]) `` function

if you want to obtain arrays(chunks) of rows.

It is possible to omit `chunkSize` parameter, then it will equal 1.

```ts
// type of asyncGen: AsyncGenerator<{name: string; age: number}[], void, unknown>
const asyncGen = sql<{ name: string; age: number }>`
    select name,age 
    from users;
`.chunked(3);

for await (const chunk of asyncGen) {
  // type of chunk: {name: string; age: number}[]
  // each chunk will contain 3 rows
  console.log(chunk);
}
```

You can also iterate over async generator the way below

```ts
let result = await asyncGen.next();
while (!result.done) {
  const row = result.value;
  // Process each row
  console.log(row);

  result = await asyncGen.next();
}
```

## `` sql`...`.toSQL `` function

Function will return sql query and array of parameters.

Function call will not execute query.

```ts
const name = "Al",
  age = 23;

const query = sql`
		select name, age
		from users
		where age >= ${age}
    and name like ${name + "%"};
	`;

const { query, params } = query.toSQL();
// query = "select name, age from users where age >= $1 and name like $2;"
// params = [23, "Al%"]
```
