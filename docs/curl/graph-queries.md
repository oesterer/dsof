# Sample `curl` requests for the DSOF GraphQL API

All examples assume the service is running locally on `http://localhost:4000/graphql`.

## List several constellations

```bash
curl -s \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "query { constellations { abbreviation name rankOrder } }"
  }' \
  http://localhost:4000/graphql | jq
```

## Fetch a constellation with line points and top stars

```bash
curl -s \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "query($abbr: String!) { constellation(abbreviation: $abbr) { name labelRaHours labelDecDeg linePoints { lineIndex pointIndex raHours decDeg } stars(limit: 5, minMagnitude: 6.0) { hrNumber name magnitude } messierObjects { designation objectType } } }",
    "variables": { "abbr": "Ori" }
  }' \
  http://localhost:4000/graphql | jq
```

## Look up an individual star by HR number

```bash
curl -s \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "query($hr: Int!) { star(hrNumber: $hr) { hrNumber name magnitude constellation { name } } }",
    "variables": { "hr": 2491 }
  }' \
  http://localhost:4000/graphql | jq
```

## List Messier galaxies in Virgo

```bash
curl -s \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "query($type: String!, $constellation: String) { messierObjects(objectType: $type, constellation: $constellation) { designation name objectType constellation { name } } }",
    "variables": { "type": "galaxy", "constellation": "Vir" }
  }' \
  http://localhost:4000/graphql | jq
```

## Retrieve planets with orbital elements

```bash
curl -s \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{
    "query": "{ planets { name displayName colorHex orbitalElements { semiMajorAxisAu eccentricity inclinationDeg meanMotionDegPerDay } } }"
  }' \
  http://localhost:4000/graphql | jq
```

> Tip: Remove the final `| jq` if you do not have `jq` installed.
