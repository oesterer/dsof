# DSOF GraphQL Service

TypeScript GraphQL gateway that exposes the Deep Sky Object Finder catalog stored in MySQL.

## Prerequisites

- Node.js 18+
- MySQL database populated with the schema/data in `db/mysql`
- Password stored in `~/.apikeys/mysql_dsof` (or exported via `MYSQL_DSOF_PASSWORD`)

## Installation

```bash
cd services/graphql
npm install
```

## Running locally

```bash
npm run dev
```

This launches the service on <http://localhost:4000/graphql>. Use `npm run build && npm start` for a production build.

## Environment overrides

| Variable | Default | Description |
| --- | --- | --- |
| `MYSQL_DSOF_HOST` | `127.0.0.1` | MySQL host |
| `MYSQL_DSOF_PORT` | `3306` | MySQL port |
| `MYSQL_DSOF_USER` | `dsof` | Database user |
| `MYSQL_DSOF_DATABASE` | `dsof` | Database name |
| `MYSQL_DSOF_PASSWORD` | *(from file)* | Database password, overrides the file lookup |
| `PORT` | `4000` | GraphQL HTTP port |

## Sample queries

See [`docs/curl/graph-queries.md`](../../docs/curl/graph-queries.md) for ready-to-run `curl` examples.
