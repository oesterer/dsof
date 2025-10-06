# dsof

## Data sources

- Bright stars use the Yale Bright Star Catalog (V/50). Download `catalog.gz` from the CDS archive, unzip it to `data/catalog`, then run `node scripts/tools/buildBrightStarCatalog.mjs` to refresh `data/brightStars.js`.
- Supplemental proper names are merged from the open HYG catalogue (optional). Place `data/hyg_v36.csv` next to the script before regenerating to include the extra names.
