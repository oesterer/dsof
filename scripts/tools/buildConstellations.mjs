import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const linesPath = join(__dirname, 'constellations.lines.json');
const metadataPath = join(__dirname, 'constellations.json');
const outputPath = join(__dirname, '../../data/constellations.js');

function normalizeRaHours(value) {
  const normalized = ((value % 360) + 360) % 360;
  return Number((normalized / 15).toFixed(4));
}

function normalizeDecDeg(value) {
  return Number(value.toFixed(4));
}

function normalizeName(value) {
  if (!value) {
    return value;
  }
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u00A0]/g, ' ');
}

const linesData = JSON.parse(readFileSync(linesPath, 'utf8'));
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

const metadataById = new Map();
metadata.features.forEach((feature) => {
  const list = metadataById.get(feature.id) || [];
  list.push(feature.properties || {});
  metadataById.set(feature.id, list);
});

const NAME_OVERRIDES = new Map([
  ['CrA', 'Corona Australis'],
]);

const aggregated = new Map();

linesData.features.forEach((feature) => {
  const { id, properties, geometry } = feature;
  const metaList = metadataById.get(id) || [];
  const meta = metaList.shift() || {};
  metadataById.set(id, metaList);

  const name = normalizeName(meta.name || meta.en || meta.la || id);
  const rank = properties?.rank ? Number.parseInt(properties.rank, 10) : null;
  const lines = (geometry?.coordinates || []).map((segment) =>
    segment.map(([raDeg, decDeg]) => ({
      raHours: normalizeRaHours(raDeg),
      decDeg: normalizeDecDeg(decDeg),
    }))
  );

  const display = Array.isArray(meta.display)
    ? {
        raHours: normalizeRaHours(meta.display[0]),
        decDeg: normalizeDecDeg(meta.display[1]),
      }
    : null;

  let entry = aggregated.get(id);
  if (!entry) {
    entry = {
      names: [],
      abbreviation: id,
      rank: Number.isFinite(rank) ? rank : null,
      lines: [],
      labels: [],
    };
    aggregated.set(id, entry);
  } else {
    if (Number.isFinite(rank)) {
      if (!Number.isFinite(entry.rank) || rank < entry.rank) {
        entry.rank = rank;
      }
    }
  }

  if (name) {
    entry.names.push(name);
  }
  entry.lines.push(...lines);
  if (display) {
    entry.labels.push(display);
  }
});

function averageLabel(labels) {
  if (!labels || labels.length === 0) {
    return null;
  }
  if (labels.length === 1) {
    return labels[0];
  }

  let sinSum = 0;
  let cosSum = 0;
  let decSum = 0;

  labels.forEach(({ raHours, decDeg }) => {
    const raRad = (raHours * Math.PI) / 12;
    sinSum += Math.sin(raRad);
    cosSum += Math.cos(raRad);
    decSum += decDeg;
  });

  const avgRaRad = Math.atan2(sinSum, cosSum);
  const avgRaDeg = (avgRaRad * 180) / Math.PI;
  const raHours = normalizeRaHours(avgRaDeg);
  const decDeg = normalizeDecDeg(decSum / labels.length);

  return { raHours, decDeg };
}

const constellations = Array.from(aggregated.values())
  .map((entry) => {
    const label = averageLabel(entry.labels);
    const uniqueNames = Array.from(new Set(entry.names));
    const overrideName = NAME_OVERRIDES.get(entry.abbreviation);
    const primaryName = overrideName
      || (entry.abbreviation === 'Ser' ? 'Serpens' : (uniqueNames[0] || entry.abbreviation));

    return {
      name: normalizeName(primaryName),
      abbreviation: entry.abbreviation,
      rank: entry.rank,
      lines: entry.lines,
      label,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const serialized = JSON.stringify(constellations, null, 2).replace(
  /"([a-zA-Z0-9_]+)":/g,
  '$1:'
);

const output = `export const CONSTELLATIONS = ${serialized};\n`;

writeFileSync(outputPath, output);
