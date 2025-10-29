import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

async function loadExportLiteral(relPath, exportName) {
  const filePath = path.resolve(projectRoot, relPath);
  const content = await fs.readFile(filePath, 'utf8');
  const marker = `export const ${exportName}`;
  const startIndex = content.indexOf(marker);
  if (startIndex === -1) {
    throw new Error(`Export ${exportName} not found in ${relPath}`);
  }
  let index = startIndex + marker.length;
  while (index < content.length && /[\s=]/.test(content[index])) {
    index += 1;
  }
  const startChar = content[index];
  if (startChar !== '[' && startChar !== '{') {
    throw new Error(`Unexpected literal start for ${exportName} in ${relPath}`);
  }
  const stack = [];
  const pairs = { '[': ']', '{': '}' };
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let endIndex = index;
  for (; endIndex < content.length; endIndex += 1) {
    const ch = content[endIndex];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      inString = true;
      stringChar = ch;
      escaped = false;
      continue;
    }
    if (ch === '[' || ch === '{') {
      stack.push(pairs[ch]);
      continue;
    }
    if (ch === ']' || ch === '}') {
      if (stack.length === 0 || stack[stack.length - 1] !== ch) {
        throw new Error(`Mismatched bracket while parsing ${exportName} in ${relPath}`);
      }
      stack.pop();
      if (stack.length === 0) {
        endIndex += 1;
        break;
      }
      continue;
    }
  }
  const literal = content.slice(index, endIndex);
  return literal.trim();
}

async function loadArray(relPath, exportName) {
  const literal = await loadExportLiteral(relPath, exportName);
  // eslint-disable-next-line no-new-func
  const value = new Function(`"use strict"; return (${literal});`)();
  if (!Array.isArray(value)) {
    throw new Error(`${exportName} in ${relPath} is not an array`);
  }
  return value;
}

async function loadObject(relPath, exportName) {
  const literal = await loadExportLiteral(relPath, exportName);
  // eslint-disable-next-line no-new-func
  const value = new Function(`"use strict"; return (${literal});`)();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${exportName} in ${relPath} is not an object`);
  }
  return value;
}

function escapeString(value) {
  return value.replace(/'/g, "''");
}

function sqlValue(value) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return String(value);
    }
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return `'${escapeString(String(value))}'`;
}

function generateInserts(tableName, columns, rows) {
  const lines = [];
  for (const row of rows) {
    const values = columns.map((column) => sqlValue(row[column]));
    lines.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
  }
  return lines.join('\n');
}

async function main() {
  const constellations = await loadArray('data/constellations.js', 'CONSTELLATIONS');
  const brightStars = await loadArray('data/brightStars.js', 'BRIGHT_STARS');
  const messierObjects = await loadArray('data/messier.js', 'MESSIER_OBJECTS');
  const planets = await loadArray('data/planets.js', 'PLANETS');
  const earthOrbit = await loadObject('data/planets.js', 'EARTH_ORBIT');

  const constellationRows = constellations.map((con) => ({
    abbreviation: con.abbreviation,
    name: con.name,
    rank: con.rank ?? null,
    label_ra_hours: con.label?.raHours ?? null,
    label_dec_deg: con.label?.decDeg ?? null,
  }));

  const constellationLineRows = [];
  constellations.forEach((con) => {
    (con.lines || []).forEach((line, lineIndex) => {
      (line || []).forEach((point, pointIndex) => {
        constellationLineRows.push({
          constellation_abbreviation: con.abbreviation,
          line_index: lineIndex + 1,
          point_index: pointIndex + 1,
          ra_hours: point?.raHours ?? null,
          dec_deg: point?.decDeg ?? null,
        });
      });
    });
  });

  const starRows = brightStars.map((star) => ({
    hr_number: star.hr,
    name: star.name,
    ra_hours: star.raHours,
    dec_deg: star.decDeg,
    magnitude: star.mag ?? null,
    flamsteed_designation: star.flamsteed ?? null,
    bayer_designation: star.bayer ?? null,
    constellation_abbreviation: star.constellation ?? null,
  }));

  const messierRows = messierObjects.map((obj) => ({
    designation: obj.designation,
    name: obj.name ?? null,
    object_type: obj.type,
    ra_hours: obj.raHours,
    dec_deg: obj.decDeg,
    constellation_abbreviation: obj.constellation ?? null,
  }));

  const planetRows = planets.map((planet) => ({
    name: planet.name,
    display_name: planet.displayName ?? planet.name,
    color_hex: planet.color ?? null,
    icon: planet.icon ?? null,
    size: planet.size ?? null,
    elements: planet.elements,
  }));

  if (!planetRows.some((planet) => planet.name === 'Earth')) {
    planetRows.push({
      name: 'Earth',
      display_name: 'Earth',
      color_hex: null,
      icon: 'circle',
      size: null,
      elements: earthOrbit,
    });
  }

  const planetTableRows = planetRows.map((planet) => ({
    name: planet.name,
    display_name: planet.display_name,
    color_hex: planet.color_hex,
    size: planet.size,
    icon: planet.icon,
  }));

  const planetElementRows = planetRows.map((planet) => ({
    planet_name: planet.name,
    semi_major_axis_au: planet.elements?.semiMajorAxisAU ?? null,
    eccentricity: planet.elements?.eccentricity ?? null,
    inclination_deg: planet.elements?.inclinationDeg ?? null,
    longitude_ascending_node_deg: planet.elements?.longitudeAscendingNodeDeg ?? null,
    longitude_perihelion_deg: planet.elements?.longitudePerihelionDeg ?? null,
    mean_longitude_deg: planet.elements?.meanLongitudeDeg ?? null,
    mean_motion_deg_per_day: planet.elements?.meanMotionDegPerDay ?? null,
  }));

  const deleteStatements = [
    'DELETE FROM planet_orbital_elements;',
    'DELETE FROM planets;',
    'DELETE FROM constellation_line_points;',
    'DELETE FROM stars;',
    'DELETE FROM messier_objects;',
    'DELETE FROM constellations;',
  ].join('\n');

  const inserts = [
    generateInserts('constellations', ['abbreviation', 'name', 'rank', 'label_ra_hours', 'label_dec_deg'], constellationRows),
    generateInserts('constellation_line_points', ['constellation_abbreviation', 'line_index', 'point_index', 'ra_hours', 'dec_deg'], constellationLineRows),
    generateInserts('stars', ['hr_number', 'name', 'ra_hours', 'dec_deg', 'magnitude', 'flamsteed_designation', 'bayer_designation', 'constellation_abbreviation'], starRows),
    generateInserts('messier_objects', ['designation', 'name', 'object_type', 'ra_hours', 'dec_deg', 'constellation_abbreviation'], messierRows),
    generateInserts('planets', ['name', 'display_name', 'color_hex', 'size', 'icon'], planetTableRows),
    generateInserts('planet_orbital_elements', ['planet_name', 'semi_major_axis_au', 'eccentricity', 'inclination_deg', 'longitude_ascending_node_deg', 'longitude_perihelion_deg', 'mean_longitude_deg', 'mean_motion_deg_per_day'], planetElementRows),
  ].join('\n\n');

  const header = `-- Auto-generated on ${new Date().toISOString()} by scripts/tools/generateDatabaseSql.mjs`;
  const loadScript = `${header}\n\n${deleteStatements}\n\n${inserts}\n`;

  const targets = [
    path.resolve(projectRoot, 'db', 'mysql', 'load_data.sql'),
    path.resolve(projectRoot, 'db', 'oracle', 'load_data.sql'),
    path.resolve(projectRoot, 'db', 'duckdb', 'load_data.sql'),
  ];

  await Promise.all(targets.map(async (target) => {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, loadScript, 'utf8');
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
