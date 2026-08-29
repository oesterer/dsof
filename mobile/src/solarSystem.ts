import { EARTH_ORBIT, PLANETS } from './data/planets';

type OrbitalElements = { semiMajorAxisAU: number; eccentricity: number; inclinationDeg: number; longitudeAscendingNodeDeg: number; longitudePerihelionDeg: number; meanLongitudeDeg: number; meanMotionDegPerDay: number };
export type SolarBody = { name: string; color: string; size: number; raHours: number; decDeg: number; illumination?: number; waxing?: boolean; phaseName?: string; distanceKm?: number };

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4367 * DEG;
const normalize = (value: number) => ((value % 360) + 360) % 360;

function solveKepler(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-7) break;
  }
  return eccentricAnomaly;
}

function heliocentric(elements: OrbitalElements, days: number) {
  const ascendingNode = elements.longitudeAscendingNodeDeg * DEG;
  const perihelion = elements.longitudePerihelionDeg * DEG;
  const inclination = elements.inclinationDeg * DEG;
  const meanLongitude = normalize(elements.meanLongitudeDeg + elements.meanMotionDegPerDay * days) * DEG;
  const meanAnomaly = normalize((meanLongitude - perihelion) / DEG) * DEG;
  const eccentricAnomaly = solveKepler(meanAnomaly, elements.eccentricity);
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + elements.eccentricity) * Math.sin(eccentricAnomaly / 2), Math.sqrt(1 - elements.eccentricity) * Math.cos(eccentricAnomaly / 2));
  const distance = elements.semiMajorAxisAU * (1 - elements.eccentricity * Math.cos(eccentricAnomaly));
  const argument = trueAnomaly + perihelion - ascendingNode;
  return {
    x: distance * (Math.cos(ascendingNode) * Math.cos(argument) - Math.sin(ascendingNode) * Math.sin(argument) * Math.cos(inclination)),
    y: distance * (Math.sin(ascendingNode) * Math.cos(argument) + Math.cos(ascendingNode) * Math.sin(argument) * Math.cos(inclination)),
    z: distance * Math.sin(argument) * Math.sin(inclination),
  };
}

function toRaDec(vector: { x: number; y: number; z: number }) {
  const equatorial = { x: vector.x, y: vector.y * Math.cos(OBLIQUITY) - vector.z * Math.sin(OBLIQUITY), z: vector.y * Math.sin(OBLIQUITY) + vector.z * Math.cos(OBLIQUITY) };
  const distance = Math.hypot(equatorial.x, equatorial.y, equatorial.z) || 1;
  return { raHours: normalize(Math.atan2(equatorial.y, equatorial.x) / DEG) / 15, decDeg: Math.asin(equatorial.z / distance) / DEG };
}

function moonPhaseName(illumination: number, waxing: boolean) {
  if (illumination < 0.03) return 'New Moon';
  if (illumination < 0.47) return waxing ? 'Waxing Crescent' : 'Waning Crescent';
  if (illumination < 0.53) return waxing ? 'First Quarter' : 'Last Quarter';
  if (illumination < 0.97) return waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
  return 'Full Moon';
}

function computeMoon(date: Date, sunEclipticLongitude: number): SolarBody {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const centuries = (jd - 2451545) / 36525;
  const days = jd - 2451545;
  const meanLongitude = normalize(218.3164477 + 13.17639648 * days) * DEG;
  const elongation = normalize(297.8501921 + 12.19074912 * days) * DEG;
  const solarAnomaly = normalize(357.5291092 + 0.98560028 * days) * DEG;
  const lunarAnomaly = normalize(134.9633964 + 13.06499295 * days) * DEG;
  const argumentLatitude = normalize(93.272095 + 13.22935024 * days) * DEG;
  const eccentricity = 1 - 0.002516 * centuries - 0.0000074 * centuries ** 2;
  const longitude = meanLongitude + (
    6.289 * Math.sin(lunarAnomaly) + 1.274 * Math.sin(2 * elongation - lunarAnomaly) +
    0.658 * Math.sin(2 * elongation) + 0.214 * Math.sin(2 * lunarAnomaly) + 0.11 * Math.sin(elongation) -
    0.186 * eccentricity * Math.sin(solarAnomaly)
  ) * DEG;
  const latitude = (5.128 * Math.sin(argumentLatitude) + 0.28 * Math.sin(lunarAnomaly + argumentLatitude) + 0.277 * Math.sin(lunarAnomaly - argumentLatitude) + 0.173 * Math.sin(2 * elongation - argumentLatitude)) * DEG;
  const coordinates = toRaDec({ x: Math.cos(latitude) * Math.cos(longitude), y: Math.cos(latitude) * Math.sin(longitude), z: Math.sin(latitude) });
  const lunarLongitude = normalize(longitude / DEG);
  const phaseAngle = normalize(lunarLongitude - sunEclipticLongitude) * DEG;
  const illumination = (1 - Math.cos(phaseAngle)) / 2;
  const waxing = normalize(lunarLongitude - sunEclipticLongitude) < 180;
  const distanceKm = 385000.56 - 20905.355 * Math.cos(lunarAnomaly) - 3699.111 * Math.cos(2 * elongation - lunarAnomaly) - 2955.968 * Math.cos(2 * elongation);
  return { name: 'Moon', color: '#eef2f5', size: 12, ...coordinates, illumination, waxing, phaseName: moonPhaseName(illumination, waxing), distanceKm };
}

export function computeSolarSystem(date: Date): SolarBody[] {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const earth = heliocentric(EARTH_ORBIT as OrbitalElements, days);
  const sunVector = { x: -earth.x, y: -earth.y, z: -earth.z };
  const sun = toRaDec(sunVector);
  const sunEclipticLongitude = normalize(Math.atan2(sunVector.y, sunVector.x) / DEG);
  const bodies: SolarBody[] = [{ name: 'Sun', color: '#ffd56a', size: 9, ...sun }];
  for (const planet of PLANETS) {
    const position = heliocentric(planet.elements as OrbitalElements, days);
    const coordinates = toRaDec({ x: position.x - earth.x, y: position.y - earth.y, z: position.z - earth.z });
    bodies.push({ name: planet.displayName, color: planet.color, size: planet.size, ...coordinates });
  }
  bodies.push(computeMoon(date, sunEclipticLongitude));
  return bodies;
}
