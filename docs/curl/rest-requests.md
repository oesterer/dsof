# Sample `curl` requests for the DSOF Spring REST API

Base URL: `http://localhost:8080`

## List constellations

```bash
curl -s http://localhost:8080/api/constellations | jq
```

## Constellation detail with stars and Messier objects

```bash
curl -s "http://localhost:8080/api/constellations/Ori?includeStars=true&starLimit=5&includeMessier=true" | jq
```

## Filter stars by magnitude

```bash
curl -s "http://localhost:8080/api/stars?limit=25&minMagnitude=5.5" | jq
```

## Fetch a Messier entry

```bash
curl -s http://localhost:8080/api/messier/M42 | jq
```

## Retrieve planets with orbital data

```bash
curl -s http://localhost:8080/api/planets | jq
curl -s http://localhost:8080/api/planets/Jupiter | jq
```

> Remove `| jq` if you do not have jq installed.
