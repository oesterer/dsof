import type { Pool } from 'mysql2/promise';
import { Row } from './db.js';

type Maybe<T> = T | null;

type StringOrNumber = string | number | null;

function toNumber(value: StringOrNumber): Maybe<number> {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface Constellation {
  abbreviation: string;
  name: string;
  rankOrder: Maybe<number>;
  labelRaHours: Maybe<number>;
  labelDecDeg: Maybe<number>;
}

export interface ConstellationLinePoint {
  lineIndex: number;
  pointIndex: number;
  raHours: number;
  decDeg: number;
}

export interface Star {
  hrNumber: number;
  name: string;
  raHours: number;
  decDeg: number;
  magnitude: Maybe<number>;
  flamsteedDesignation: Maybe<string>;
  bayerDesignation: Maybe<string>;
  constellationAbbreviation: Maybe<string>;
}

export interface MessierObject {
  designation: string;
  name: Maybe<string>;
  objectType: string;
  raHours: number;
  decDeg: number;
  constellationAbbreviation: Maybe<string>;
}

export interface Planet {
  name: string;
  displayName: string;
  colorHex: Maybe<string>;
  size: Maybe<number>;
  icon: Maybe<string>;
}

export interface PlanetOrbitalElements {
  planetName: string;
  semiMajorAxisAu: Maybe<number>;
  eccentricity: Maybe<number>;
  inclinationDeg: Maybe<number>;
  longitudeAscendingNodeDeg: Maybe<number>;
  longitudePerihelionDeg: Maybe<number>;
  meanLongitudeDeg: Maybe<number>;
  meanMotionDegPerDay: Maybe<number>;
}

export async function getConstellations(pool: Pool, abbreviation?: string): Promise<Constellation[]> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT abbreviation, name, rank_order, label_ra_hours, label_dec_deg
     FROM constellations
     ${abbreviation ? 'WHERE abbreviation = :abbr' : ''}
     ORDER BY abbreviation`,
    abbreviation ? { abbr: abbreviation } : undefined
  );
  return rows.map((row) => ({
    abbreviation: String(row.abbreviation),
    name: String(row.name),
    rankOrder: toNumber(row.rank_order),
    labelRaHours: toNumber(row.label_ra_hours),
    labelDecDeg: toNumber(row.label_dec_deg),
  }));
}

export async function getConstellationLinePoints(pool: Pool, abbreviation: string): Promise<ConstellationLinePoint[]> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT line_index, point_index, ra_hours, dec_deg
     FROM constellation_line_points
     WHERE constellation_abbreviation = :abbr
     ORDER BY line_index, point_index`,
    { abbr: abbreviation }
  );
  return rows.map((row) => ({
    lineIndex: Number(row.line_index),
    pointIndex: Number(row.point_index),
    raHours: Number(row.ra_hours),
    decDeg: Number(row.dec_deg),
  }));
}

export interface StarQueryOptions {
  limit?: number;
  minMagnitude?: number;
  maxMagnitude?: number;
  constellationAbbreviation?: string;
}

export async function getStars(pool: Pool, options: StarQueryOptions = {}): Promise<Star[]> {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options.minMagnitude !== undefined) {
    conditions.push('magnitude <= :minMag');
    params.minMag = options.minMagnitude;
  }
  if (options.maxMagnitude !== undefined) {
    conditions.push('magnitude >= :maxMag');
    params.maxMag = options.maxMagnitude;
  }
  if (options.constellationAbbreviation) {
    conditions.push('constellation_abbreviation = :constellation');
    params.constellation = options.constellationAbbreviation;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = options.limit ? 'LIMIT :limit' : '';
  if (options.limit) {
    params.limit = options.limit;
  }

  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT hr_number, name, ra_hours, dec_deg, magnitude, flamsteed_designation, bayer_designation, constellation_abbreviation
     FROM stars
     ${whereClause}
     ORDER BY magnitude IS NULL, magnitude ASC, hr_number ASC
     ${limitClause}`,
    params
  );

  return rows.map((row) => ({
    hrNumber: Number(row.hr_number),
    name: String(row.name),
    raHours: Number(row.ra_hours),
    decDeg: Number(row.dec_deg),
    magnitude: toNumber(row.magnitude),
    flamsteedDesignation: row.flamsteed_designation ? String(row.flamsteed_designation) : null,
    bayerDesignation: row.bayer_designation ? String(row.bayer_designation) : null,
    constellationAbbreviation: row.constellation_abbreviation ? String(row.constellation_abbreviation) : null,
  }));
}

export async function getStarByHr(pool: Pool, hrNumber: number): Promise<Star | null> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT hr_number, name, ra_hours, dec_deg, magnitude, flamsteed_designation, bayer_designation, constellation_abbreviation
     FROM stars
     WHERE hr_number = :hr
     LIMIT 1`,
    { hr: hrNumber }
  );
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    hrNumber: Number(row.hr_number),
    name: String(row.name),
    raHours: Number(row.ra_hours),
    decDeg: Number(row.dec_deg),
    magnitude: toNumber(row.magnitude),
    flamsteedDesignation: row.flamsteed_designation ? String(row.flamsteed_designation) : null,
    bayerDesignation: row.bayer_designation ? String(row.bayer_designation) : null,
    constellationAbbreviation: row.constellation_abbreviation ? String(row.constellation_abbreviation) : null,
  };
}

export interface MessierQueryOptions {
  objectType?: string;
  constellationAbbreviation?: string;
}

export async function getMessierObjects(pool: Pool, options: MessierQueryOptions = {}): Promise<MessierObject[]> {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options.objectType) {
    conditions.push('object_type = :objectType');
    params.objectType = options.objectType;
  }
  if (options.constellationAbbreviation) {
    conditions.push('constellation_abbreviation = :constellation');
    params.constellation = options.constellationAbbreviation;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT designation, name, object_type, ra_hours, dec_deg, constellation_abbreviation
     FROM messier_objects
     ${whereClause}
     ORDER BY designation`,
    params
  );

  return rows.map((row) => ({
    designation: String(row.designation),
    name: row.name ? String(row.name) : null,
    objectType: String(row.object_type),
    raHours: Number(row.ra_hours),
    decDeg: Number(row.dec_deg),
    constellationAbbreviation: row.constellation_abbreviation ? String(row.constellation_abbreviation) : null,
  }));
}

export async function getMessierObject(pool: Pool, designation: string): Promise<MessierObject | null> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT designation, name, object_type, ra_hours, dec_deg, constellation_abbreviation
     FROM messier_objects
     WHERE designation = :designation
     LIMIT 1`,
    { designation }
  );
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    designation: String(row.designation),
    name: row.name ? String(row.name) : null,
    objectType: String(row.object_type),
    raHours: Number(row.ra_hours),
    decDeg: Number(row.dec_deg),
    constellationAbbreviation: row.constellation_abbreviation ? String(row.constellation_abbreviation) : null,
  };
}

export async function getPlanets(pool: Pool): Promise<Planet[]> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT name, display_name, color_hex, size, icon
     FROM planets
     ORDER BY name`
  );
  return rows.map((row) => ({
    name: String(row.name),
    displayName: String(row.display_name),
    colorHex: row.color_hex ? String(row.color_hex) : null,
    size: toNumber(row.size),
    icon: row.icon ? String(row.icon) : null,
  }));
}

export async function getPlanet(pool: Pool, name: string): Promise<Planet | null> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT name, display_name, color_hex, size, icon
     FROM planets
     WHERE name = :name
     LIMIT 1`,
    { name }
  );
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    name: String(row.name),
    displayName: String(row.display_name),
    colorHex: row.color_hex ? String(row.color_hex) : null,
    size: toNumber(row.size),
    icon: row.icon ? String(row.icon) : null,
  };
}

export async function getOrbitalElements(pool: Pool, planetName: string): Promise<PlanetOrbitalElements | null> {
  const [rows] = await pool.query<Row<Record<string, unknown>>>(
    `SELECT planet_name, semi_major_axis_au, eccentricity, inclination_deg, longitude_ascending_node_deg, longitude_perihelion_deg, mean_longitude_deg, mean_motion_deg_per_day
     FROM planet_orbital_elements
     WHERE planet_name = :planet
     LIMIT 1`,
    { planet: planetName }
  );
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    planetName: String(row.planet_name),
    semiMajorAxisAu: toNumber(row.semi_major_axis_au),
    eccentricity: toNumber(row.eccentricity),
    inclinationDeg: toNumber(row.inclination_deg),
    longitudeAscendingNodeDeg: toNumber(row.longitude_ascending_node_deg),
    longitudePerihelionDeg: toNumber(row.longitude_perihelion_deg),
    meanLongitudeDeg: toNumber(row.mean_longitude_deg),
    meanMotionDegPerDay: toNumber(row.mean_motion_deg_per_day),
  };
}
