import { EARTH_ORBIT, PLANETS } from './data/planets';

type OrbitalElements = { semiMajorAxisAU: number; eccentricity: number; inclinationDeg: number; longitudeAscendingNodeDeg: number; longitudePerihelionDeg: number; meanLongitudeDeg: number; meanMotionDegPerDay: number };
export type SolarBody = { name: string; color: string; size: number; raHours: number; decDeg: number };

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

export function computeSolarSystem(date: Date): SolarBody[] {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const earth = heliocentric(EARTH_ORBIT as OrbitalElements, days);
  const sun = toRaDec({ x: -earth.x, y: -earth.y, z: -earth.z });
  const bodies: SolarBody[] = [{ name: 'Sun', color: '#ffd56a', size: 9, ...sun }];
  for (const planet of PLANETS) {
    const position = heliocentric(planet.elements as OrbitalElements, days);
    const coordinates = toRaDec({ x: position.x - earth.x, y: position.y - earth.y, z: position.z - earth.z });
    bodies.push({ name: planet.displayName, color: planet.color, size: planet.size, ...coordinates });
  }
  return bodies;
}
