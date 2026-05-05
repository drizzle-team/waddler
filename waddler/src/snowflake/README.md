# `waddler/snowflake`

`waddler/snowflake` wraps a single `snowflake-sdk` `Connection` and connects lazily on the first query or stream.

Waddler supports Snowflake's SSO authentication methods including browser-based login, OAuth, and key-pair authentication.

## Object-Based Configuration

Object-based configuration is recommended for SSO and any authenticator that needs extra options.

```ts
import { waddler } from 'waddler/snowflake';

// External browser SSO (opens browser for login)
const sql = waddler({
  connection: {
    account: 'myaccount',
    username: 'myuser@example.com',
    authenticator: 'EXTERNALBROWSER',
    database: 'MY_DB',
    warehouse: 'MY_WH',
  },
});

// OAuth with token
const sqlOAuth = waddler({
  connection: {
    account: 'myaccount',
    username: 'myuser',
    authenticator: 'OAUTH',
    token: process.env.SNOWFLAKE_OAUTH_TOKEN,
  },
});

// Key-pair authentication
const sqlKeyPair = waddler({
  connection: {
    account: 'myaccount',
    username: 'myuser',
    authenticator: 'SNOWFLAKE_JWT',
    privateKeyPath: '/path/to/rsa_key.p8',
    privateKeyPass: 'passphrase', // if encrypted
  },
});
```

## Connection Strings

Connection strings support the default Snowflake password authenticator, passwordless `EXTERNALBROWSER`, and native Okta SSO via an `https://*.okta.com` authenticator URL.

```ts
// EXTERNALBROWSER via connection string (opens browser)
const sql = waddler(
  'snowflake://user@account/DB/SCHEMA?warehouse=WH&authenticator=EXTERNALBROWSER',
);
```

Use object-based configuration for `OAUTH`, `SNOWFLAKE_JWT`, `USERNAME_PASSWORD_MFA`, `OAUTH_AUTHORIZATION_CODE`, `OAUTH_CLIENT_CREDENTIALS`, `PROGRAMMATIC_ACCESS_TOKEN`, and `WORKLOAD_IDENTITY` so any required authentication options can be supplied.
