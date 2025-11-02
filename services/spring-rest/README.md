# DSOF Spring Boot REST Service

A Java 17 Spring Boot API that exposes the Deep Sky Object Finder catalog stored in MySQL.

## Prerequisites

- JDK 21+ (automatic download via Gradle toolchains is supported)
- Gradle (wrapper will be generated automatically by running `./gradlew`)
- MySQL database created using the schema/data under `db/mysql`
- Database password available in either:
  - the file `~/.apikeys/mysql_dsof` (default), or
  - the `MYSQL_DSOF_PASSWORD` environment variable

## Configuration

All configuration values can be overridden via environment variables:

| Property | Default | Description |
| --- | --- | --- |
| `MYSQL_DSOF_HOST` | `127.0.0.1` | MySQL host |
| `MYSQL_DSOF_PORT` | `3306` | MySQL port |
| `MYSQL_DSOF_USER` | `dsof` | Database user |
| `MYSQL_DSOF_DATABASE` | `dsof` | Database name |
| `MYSQL_DSOF_PASSWORD` | *(empty)* | Password (overrides password file) |
| `MYSQL_DSOF_PASSWORD_FILE` | `~/.apikeys/mysql_dsof` | File containing password |
| `PORT` | `8080` | HTTP server port |

## Build & run

```bash
cd services/spring-rest
./gradlew bootRun
```

The service starts on `http://localhost:8080` by default.

### Example endpoints

- `GET /api/constellations` — list constellations
- `GET /api/constellations/Orion?includeStars=true&starLimit=10` — constellation details with top stars
- `GET /api/stars?limit=20&minMagnitude=4.0` — bright stars
- `GET /api/messier?objectType=galaxy&constellation=Vir` — Messier catalog filter
- `GET /api/planets` — planets with summary data
- `GET /api/planets/Mars` — single planet with orbital elements

Responses are formatted as JSON with indentation enabled for readability.
