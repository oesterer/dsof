export type CatalogStar = { hr: number; name: string; properName?: string; raHours: number; decDeg: number; mag: number; bayer?: string; constellation?: string };
export type HorizontalStar = CatalogStar & { altitude: number; azimuth: number };
export type ProjectedStar = HorizontalStar & { x: number; y: number; radius: number };
export type HorizontalPoint = { altitude: number; azimuth: number };
export type ProjectedPoint = HorizontalPoint & { x: number; y: number };

const DEG = Math.PI / 180;
const normalizeDegrees = (value: number) => ((value % 360) + 360) % 360;
const julianDate = (date: Date) => date.getTime() / 86400000 + 2440587.5;

function localSiderealDegrees(date: Date, longitude: number) {
  const jd = julianDate(date);
  const centuries = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * centuries ** 2 - centuries ** 3 / 38710000;
  return normalizeDegrees(gmst + longitude);
}

export function toHorizontal(star: CatalogStar, latitude: number, longitude: number, date: Date): HorizontalStar {
  return { ...star, ...equatorialToHorizontal(star.raHours, star.decDeg, latitude, longitude, date) };
}

export function equatorialToHorizontal(raHours: number, decDeg: number, latitude: number, longitude: number, date: Date): HorizontalPoint {
  const lat = latitude * DEG;
  const dec = decDeg * DEG;
  const hourAngle = normalizeDegrees(localSiderealDegrees(date, longitude) - raHours * 15) * DEG;
  const sinAltitude = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
  const azimuth = Math.atan2(-Math.sin(hourAngle) * Math.cos(dec), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(hourAngle));
  return { altitude: altitude / DEG, azimuth: normalizeDegrees(azimuth / DEG) };
}

export function projectStar(star: HorizontalStar, heading: number, elevation: number, width: number, height: number, horizontalFov = 62): ProjectedStar | null {
  const point = projectHorizontalPoint(star, heading, elevation, width, height, horizontalFov);
  if (!point) return null;
  return { ...star, x: point.x, y: point.y, radius: Math.max(1.1, Math.min(4.8, 5.2 - star.mag * 0.72)) };
}

export function projectHorizontalPoint(point: HorizontalPoint, heading: number, elevation: number, width: number, height: number, horizontalFov = 62, cullToViewport = true): ProjectedPoint | null {
  const az = point.azimuth * DEG;
  const alt = point.altitude * DEG;
  const h = heading * DEG;
  const e = elevation * DEG;
  const target = [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
  const forward = [Math.cos(e) * Math.sin(h), Math.cos(e) * Math.cos(h), Math.sin(e)];
  const right = [Math.cos(h), -Math.sin(h), 0];
  const up = [-Math.sin(e) * Math.sin(h), -Math.sin(e) * Math.cos(h), Math.cos(e)];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const depth = dot(target, forward);
  if (depth <= 0.15) return null;
  const focal = width / (2 * Math.tan((horizontalFov * DEG) / 2));
  const x = width / 2 + (dot(target, right) / depth) * focal;
  const y = height / 2 - (dot(target, up) / depth) * focal;
  if (cullToViewport && (x < -12 || x > width + 12 || y < -12 || y > height + 12)) return null;
  return { ...point, x, y };
}

export function cardinalDirection(heading: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(normalizeDegrees(heading) / 45) % directions.length];
}

export function eclipticToEquatorial(longitudeDeg: number) {
  const longitude = longitudeDeg * DEG;
  const obliquity = 23.4367 * DEG;
  const x = Math.cos(longitude);
  const y = Math.sin(longitude) * Math.cos(obliquity);
  const z = Math.sin(longitude) * Math.sin(obliquity);
  return {
    raHours: normalizeDegrees(Math.atan2(y, x) / DEG) / 15,
    decDeg: Math.asin(z) / DEG,
  };
}
