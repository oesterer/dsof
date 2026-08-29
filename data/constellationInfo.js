import { CONSTELLATION_FACTS } from './constellationFacts.js';

const CONSTELLATION_STORIES = {
  'Ursa Major': 'One of the best-known northern constellations. Its Big Dipper asterism has guided travelers for centuries: Merak and Dubhe point toward Polaris. In Greek tradition it represents the Great Bear.',
  'Ursa Minor': 'The Little Bear contains Polaris, the present north celestial pole star. Its Little Dipper asterism has long been important for navigation and timekeeping in the Northern Hemisphere.',
  Orion: 'A prominent equatorial constellation identified with a hunter in Greek tradition. Its bright belt and the Orion Nebula make it an important guide to the winter sky and a rich stellar nursery.',
  Cassiopeia: 'Its distinctive W shape circles the north celestial pole and is visible for much of the year at northern latitudes. Greek tradition depicts the boastful queen Cassiopeia.',
  Andromeda: 'Named for the princess of Greek tradition, Andromeda contains M31, the nearest large galaxy to the Milky Way and the most distant object commonly visible to unaided eyes.',
  Cygnus: 'The Swan lies along the Milky Way and is marked by the Northern Cross. Deneb, its brightest star, forms part of the Summer Triangle.',
  Scorpius: 'An ancient zodiac constellation whose curved outline resembles a scorpion. Antares marks its heart, while its Milky Way fields contain many bright clusters and nebulae.',
  Leo: 'A zodiac constellation recognized since antiquity and associated with the Nemean Lion. Its Sickle asterism outlines the lion’s head and bright Regulus marks its heart.',
  Taurus: 'An ancient zodiac constellation representing a bull. It contains the Hyades and Pleiades star clusters and the supernova remnant M1, the Crab Nebula.',
  Gemini: 'The zodiac Twins are marked by Castor and Pollux. The constellation lies in a rich winter region of the Milky Way and contains the open cluster M35.',
  Sagittarius: 'A zodiac constellation toward the center of the Milky Way. Its Teapot asterism points into exceptionally rich star clouds, clusters, and nebulae.',
  Crux: 'The Southern Cross is the smallest modern constellation and a major southern navigation marker. Its long axis helps observers estimate the direction of the south celestial pole.',
  Aquarius: 'One of the ancient zodiac constellations, traditionally representing the water bearer. Its faint stars occupy a region historically associated with water-themed constellations.',
};

export function getConstellationInfo(name) {
  const facts = CONSTELLATION_FACTS[name];
  if (!facts) {
    return CONSTELLATION_STORIES[name] || `${name} is one of the 88 constellations formally recognized by the International Astronomical Union.`;
  }
  const symbol = facts.symbolism ? `Traditionally it represents ${facts.symbolism}.` : '';
  const hemisphere = facts.hemisphere === 'Both Hemispheres'
    ? 'It can be observed from both hemispheres.'
    : `It is primarily associated with the ${facts.hemisphere.toLowerCase()}.`;
  const visibility = facts.visibility === 'All year round'
    ? 'From suitable latitudes it can be observed throughout the year.'
    : `Its listed observing season is ${facts.visibility}.`;
  if (CONSTELLATION_STORIES[name]) {
    return `${CONSTELLATION_STORIES[name]} ${hemisphere} ${visibility}`;
  }
  return `${symbol} ${hemisphere} ${visibility} It is one of the 88 constellations formally recognized by the International Astronomical Union.`.trim();
}
