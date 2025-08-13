## Environment Variables

You need to add the following variables to your `.env` file so that the tests can run successfully. All of them are listed in the `.env.sample` file.

##

#### `NEON_HTTP_CONNECTION_STRING`

1. Go to your Neon console at https://console.neon.tech/app/projects.
2. Select the project you want to use for testing to open its **Project Dashboard**.
3. Click **Connect**, choose **Connection string**, and copy the provided value into your `.env` file under `NEON_HTTP_CONNECTION_STRING`.

##

#### `NEON_SERVERLESS_CONNECTION_STRING`

You can reuse the same connection string you added for `NEON_HTTP_CONNECTION_STRING`.

##

#### `VERCEL_POOL_CONNECTION_STRING`

You can reuse the same connection string as `NEON_HTTP_CONNECTION_STRING`; just be sure to **enable** **Connection pooling** in the **Connect to your database** modal.

##

#### `VERCEL_CLIENT_CONNECTION_STRING`

You can reuse the same connection string you added for `NEON_HTTP_CONNECTION_STRING`; just be sure to **disable** **Connection pooling** in the **Connect to your database** modal.

##

#### `POSTGRES_URL`

You can reuse the same connection string as `VERCEL_POOL_CONNECTION_STRING`.

##

#### `XATA_DATABASE_URL`, `XATA_API_KEY`, `XATA_BRANCH`

1. Go to https://app.xata.io/ and select the database you want to use for testing.
2. Open the **Settings** tab and, under the **Connect to your Database** section, copy the **HTTP endpoint** value. Paste it into your `.env` file as the value for `XATA_DATABASE_URL`.
3. Go to your [account settings](https://app.xata.io/settings), and under the **Personal API keys** section, generate a new API key. Paste it into your `.env` file as `XATA_API_KEY`.
4. Xata creates a default branch named `main`. If you’ve created a different branch for testing, copy its name and set it in your `.env` file as `XATA_BRANCH`.

##

#### `LIBSQL_REMOTE_URL`, `LIBSQL_REMOTE_TOKEN`

1. Go to https://app.turso.tech/ and locate the database you want to use.
2. In the database list, click the `⋮` (three dots) next to your database and select **Copy URL**. Paste this value into your `.env` file as `LIBSQL_REMOTE_URL`.
3. Click **Create Token**, configure the desired token settings, and complete the token creation process. You’ll receive:
   - A **token** → paste this into your `.env` as `LIBSQL_REMOTE_TOKEN`.
   - **URL** (same as above) → use it again for `LIBSQL_REMOTE_URL` if needed.

##

#### `TIDB_CONNECTION_STRING`

1. Go to https://tidbcloud.com/, click on the cluster you’ve selected for testing, and then click the **Connect** button.
2. In the **Connect to {Cluster name}** modal, configure your connection settings, choose **Connection String**, then copy the value and add it to your `.env` file as `TIDB_CONNECTION_STRING`.

##

#### `PLANETSCALE_CONNECTION_STRING`

1. Go to https://app.planetscale.com/, select your database.

##

#### `RUN_EXTERNAL_DB_TESTS`

If you want to run tests for any of the following drivers:

- `neon-http`
- `neon-serverless`
- `vercel-postgres`
- `xata-http`
- `libsql/http`
- `libsql/node`
- `planetscale-serverless`
- `tidb-serverless`

then set the `RUN_EXTERNAL_DB_TESTS` environment variable to any value (e.g. `1`).

If you don’t want to run external DB tests, you can omit this variable.
