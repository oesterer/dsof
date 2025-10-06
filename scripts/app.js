import { BRIGHT_STARS } from '../data/brightStars.js';
import { CONSTELLATIONS } from '../data/constellations.js';
import { MESSIER_OBJECTS } from '../data/messier.js';
import { MESSIER_IMAGES } from '../data/messierImages.js';
import { PLANETS, EARTH_ORBIT } from '../data/planets.js';
import { PLANET_IMAGES } from '../data/planetImages.js';
import { BAYER_GREEK, CONSTELLATION_GENITIVE } from '../data/starNames.js';

const canvas = document.getElementById('sky-canvas');
const ctx = canvas.getContext('2d');
const skyContainer = document.querySelector('.sky-container');
const latInput = document.getElementById('latitude');
const lonInput = document.getElementById('longitude');
const renderButton = document.getElementById('render');
const locationButton = document.getElementById('use-location');
const feedback = document.getElementById('feedback');
const timeSelect = document.getElementById('time-select');
const timeInputGroup = document.getElementById('time-input-group');
const customTimeInput = document.getElementById('custom-time');
const constellationsInput = document.getElementById('show-constellations');
const equatorialGridInput = document.getElementById('show-equatorial-grid');
const constellationLabelsInput = document.getElementById('show-constellation-labels');
const starTooltipsInput = document.getElementById('show-star-tooltips');
const messierInput = document.getElementById('show-messier');
const raGridInput = document.getElementById('ra-grid-step');
const decGridInput = document.getElementById('dec-grid-step');
const zoomInput = document.getElementById('zoom-level');
const maxMagnitudeInput = document.getElementById('max-magnitude');
const searchInput = document.getElementById('object-search');
const searchButton = document.getElementById('object-search-button');
const searchOptions = document.getElementById('object-search-options');
const tooltip = document.getElementById('sky-tooltip');

const DEFAULT_RA_STEP = 4;
const DEFAULT_DEC_STEP = 30;
const DEFAULT_MAX_MAGNITUDE = 6;
const MIN_MAGNITUDE_LIMIT = -2;
const MAX_MAGNITUDE_LIMIT = 6.5;
const ZOOM_MIN = 1;
const ZOOM_MAX = 10;
const ORIENTATION_SENSITIVITY = 0.005;
const PITCH_SENSITIVITY = 0.0045;
const PITCH_MIN = -Math.PI + 0.01;
const PITCH_MAX = Math.PI - 0.01;
const OBLIQUITY_RAD = (23.4367 * Math.PI) / 180;

let interactiveItems = [];
let isRotating = false;
let activePointerId = null;
let lastPointerX = 0;
let lastPointerY = 0;
let isRendering = false;

const maxMagnitudeInputValue = parseFloat(maxMagnitudeInput?.value);
const initialMaxMagnitude = Number.isFinite(maxMagnitudeInputValue)
  ? maxMagnitudeInputValue
  : DEFAULT_MAX_MAGNITUDE;

const MESSIER_TYPE_LABELS = {
  galaxy: 'Galaxy',
  nebula: 'Emission Nebula',
  planetary_nebula: 'Planetary Nebula',
  open_cluster: 'Open Cluster',
  globular_cluster: 'Globular Cluster',
  supernova_remnant: 'Supernova Remnant',
};

function capitalizeWord(value) {
  if (!value) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1).toLowerCase();
}

function getConstellationGenitive(code) {
  if (!code) {
    return '';
  }
  return CONSTELLATION_GENITIVE[code] || code;
}

function formatBayerDesignation(star) {
  if (!star?.bayer) {
    return '';
  }
  const base = star.bayer.slice(0, 3);
  const normalized = capitalizeWord(base);
  const greek = BAYER_GREEK[normalized] || capitalizeWord(star.bayer);
  const remainder = star.bayer.length > 3 ? star.bayer.slice(3) : '';
  const component = star.component ? star.component.trim() : '';
  const suffix = [remainder, component].filter(Boolean).join('');
  const label = suffix ? `${greek} ${suffix}`.trim() : greek;
  const constellationName = getConstellationGenitive(star.constellation);
  return constellationName ? `${label} ${constellationName}`.trim() : label;
}

function formatFlamsteedDesignation(star) {
  if (!star?.flamsteed) {
    return '';
  }
  const constellationName = getConstellationGenitive(star.constellation);
  return constellationName ? `${star.flamsteed} ${constellationName}` : star.flamsteed;
}

function getStarNameAliases(star) {
  const aliases = [];
  const seen = new Set();
  const add = (value) => {
    if (value && !seen.has(value)) {
      seen.add(value);
      aliases.push(value);
    }
  };

  add(star?.name);
  add(star?.properName);
  add(formatBayerDesignation(star));
  add(formatFlamsteedDesignation(star));
  if (star?.hr) {
    add(`HR ${star.hr}`);
  }
  if (star?.dm) {
    add(star.dm);
  }

  return aliases;
}

function isSearchableStarName(name) {
  if (typeof name !== 'string') {
    return false;
  }
  const trimmed = name.trim();
  if (!trimmed || !/[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  const upper = trimmed.toUpperCase();
  const excludedPrefixes = ['HR ', 'HD ', 'DM ', 'TYC ', 'HIP '];
  if (excludedPrefixes.some((prefix) => upper.startsWith(prefix))) {
    return false;
  }
  return true;
}

function getConstellationCoordinates(constellation) {
  if (constellation?.label && Number.isFinite(constellation.label.raHours) && Number.isFinite(constellation.label.decDeg)) {
    return {
      raHours: constellation.label.raHours,
      decDeg: constellation.label.decDeg,
    };
  }

  const points = [];
  (constellation?.lines || []).forEach((segment) => {
    segment.forEach((vertex) => {
      if (vertex && Number.isFinite(vertex.raHours) && Number.isFinite(vertex.decDeg)) {
        points.push(vertex);
      }
    });
  });

  if (points.length === 0) {
    return null;
  }

  let x = 0;
  let y = 0;
  let z = 0;

  points.forEach(({ raHours, decDeg }) => {
    const raRad = degreesToRadians(raHours * 15);
    const decRad = degreesToRadians(decDeg);
    const cosDec = Math.cos(decRad);
    x += cosDec * Math.cos(raRad);
    y += cosDec * Math.sin(raRad);
    z += Math.sin(decRad);
  });

  const length = Math.sqrt(x * x + y * y + z * z) || 1;
  const raHours = normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI) / 15;
  const decDeg = (Math.asin(z / length) * 180) / Math.PI;
  return { raHours, decDeg };
}

function buildSearchIndex() {
  const entries = [];
  const seen = new Set();

  const addEntry = (name, type, resolve, displayName) => {
    if (!name || typeof resolve !== 'function') {
      return;
    }
    const normalized = name.trim();
    if (!normalized) {
      return;
    }
    const key = `${type}:${normalized.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    entries.push({
      name: normalized,
      type,
      resolve,
      displayName: displayName || normalized,
    });
    seen.add(key);
  };

  MESSIER_OBJECTS.forEach((object) => {
    if (!Number.isFinite(object.raHours) || !Number.isFinite(object.decDeg)) {
      return;
    }
    const resolver = () => ({ raHours: object.raHours, decDeg: object.decDeg });
    addEntry(object.designation, 'messier', resolver, object.designation);
    if (object.name && object.name !== object.designation) {
      addEntry(object.name, 'messier', resolver, object.name);
    }
  });

  CONSTELLATIONS.forEach((constellation) => {
    const coords = getConstellationCoordinates(constellation);
    if (!coords) {
      return;
    }
    const resolver = () => ({ raHours: coords.raHours, decDeg: coords.decDeg });
    addEntry(constellation.name, 'constellation', resolver, constellation.name);
    if (constellation.abbreviation) {
      addEntry(constellation.abbreviation, 'constellation', resolver, constellation.name);
    }
  });

  PLANETS.forEach((planet) => {
    const resolver = ({ observationDate }) => {
      if (!(observationDate instanceof Date)) {
        return null;
      }
      const solarSystem = computeSolarSystemBodies(observationDate);
      return solarSystem.planets.find((entry) => entry.name === planet.name) || null;
    };
    addEntry(planet.displayName, 'planet', resolver, planet.displayName);
    if (planet.name && planet.name !== planet.displayName) {
      addEntry(planet.name, 'planet', resolver, planet.displayName);
    }
  });

  const sunResolver = ({ observationDate }) => {
    if (!(observationDate instanceof Date)) {
      return null;
    }
    const solarSystem = computeSolarSystemBodies(observationDate);
    return solarSystem.sun;
  };
  addEntry('Sun', 'sun', sunResolver, 'Sun');

  const moonResolver = ({ observationDate }) => {
    if (!(observationDate instanceof Date)) {
      return null;
    }
    const solarSystem = computeSolarSystemBodies(observationDate);
    const moonState = computeMoonState(observationDate, solarSystem.sun.eclipticLongitudeDeg);
    return moonState;
  };
  addEntry('Moon', 'moon', moonResolver, 'Moon');

  BRIGHT_STARS.forEach((star) => {
    if (!Number.isFinite(star.raHours) || !Number.isFinite(star.decDeg)) {
      return;
    }
    const baseResolver = () => ({ raHours: star.raHours, decDeg: star.decDeg });
    const aliases = getStarNameAliases(star);
    if (aliases.length > 0) {
      const primary = aliases[0];
      if (isSearchableStarName(primary)) {
        addEntry(primary, 'star', baseResolver, primary);
      }
      if (star.properName && star.properName !== primary && isSearchableStarName(star.properName)) {
        addEntry(star.properName, 'star', baseResolver, star.properName);
      }
      aliases.slice(1).forEach((alias) => {
        if (alias && alias !== star.properName && alias !== primary && isSearchableStarName(alias)) {
          addEntry(alias, 'star', baseResolver, alias);
        }
      });
    } else if (isSearchableStarName(star.name)) {
      addEntry(star.name, 'star', baseResolver, star.name);
    }
  });

  return entries;
}

function populateSearchSuggestions(entries) {
  if (!searchOptions || !Array.isArray(entries)) {
    return;
  }
  const MAX_SUGGESTIONS = 3000;
  const fragment = document.createDocumentFragment();
  const added = new Set();
  for (let index = 0; index < entries.length && added.size < MAX_SUGGESTIONS; index += 1) {
    const entry = entries[index];
    const key = entry.name.toLowerCase();
    if (added.has(key)) {
      continue;
    }
    added.add(key);
    const option = document.createElement('option');
    option.value = entry.name;
    fragment.appendChild(option);
  }
  searchOptions.innerHTML = '';
  searchOptions.appendChild(fragment);
}

function findSearchEntry(query, entries) {
  if (!query) {
    return null;
  }
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const exact = entries.find((entry) => entry.name.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }
  return entries.find((entry) => entry.name.toLowerCase().includes(normalized)) || null;
}

function escapeHtml(value) {
  if (value == null) {
    return '';
  }
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

function buildMessierImageUrl(item) {
  if (!item?.designation) {
    return null;
  }
  const key = item.designation.trim().toUpperCase();
  return MESSIER_IMAGES[key] || null;
}

function buildPlanetImageUrl(item) {
  if (!item) {
    return null;
  }

  const candidates = [];
  if (item.displayName) {
    candidates.push(item.displayName);
  }
  if (item.name && item.name !== item.displayName) {
    candidates.push(item.name);
  }

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    const match = Object.keys(PLANET_IMAGES).find(
      (key) => key.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) {
      return PLANET_IMAGES[match];
    }
  }

  return null;
}

function formatStarTooltip(item) {
  const alternate = [];
  if (item.properName && item.properName !== item.displayName) {
    alternate.push(item.properName);
  }
  if (item.bayerDesignation && item.bayerDesignation !== item.displayName) {
    alternate.push(item.bayerDesignation);
  }
  if (item.flamsteedDesignation && item.flamsteedDesignation !== item.displayName) {
    alternate.push(item.flamsteedDesignation);
  }
  if (item.hr) {
    alternate.push(`HR ${item.hr}`);
  }

  const heading = alternate.length > 0 ? `${item.displayName} (${alternate.join(', ')})` : item.displayName;
  const details = [];
  if (Number.isFinite(item.magnitude)) {
    details.push(`mag ${item.magnitude.toFixed(2)}`);
  }
  if (Number.isFinite(item.altitudeDeg)) {
    details.push(`alt ${item.altitudeDeg.toFixed(1)}°`);
  }

  return details.length > 0 ? `${heading} • ${details.join(' • ')}` : heading;
}

const state = {
  latitude: null,
  longitude: null,
  timeMode: 'now',
  customDate: null,
  showConstellations: constellationsInput?.checked ?? true,
  showEquatorialGrid: equatorialGridInput?.checked ?? true,
  showConstellationLabels: constellationLabelsInput?.checked ?? false,
  showStarTooltips: starTooltipsInput?.checked ?? true,
  showMessierObjects: messierInput?.checked ?? true,
  maxStarMagnitude: initialMaxMagnitude,
  raStepHours: parseFloat(raGridInput?.value) || DEFAULT_RA_STEP,
  decStepDegrees: parseFloat(decGridInput?.value) || DEFAULT_DEC_STEP,
  zoomFactor: parseFloat(zoomInput?.value) || 1,
  orientationRad: 0,
  pitchRad: 0,
};

const searchIndex = buildSearchIndex();
populateSearchSuggestions(searchIndex);

function reRenderIfPossible() {
  if (isRenderableLocation(state.latitude, state.longitude)) {
    renderSky();
  }
}

function updateFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', isError);
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

function radiansToDegrees(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeDegrees(degrees) {
  const result = degrees % 360;
  return result < 0 ? result + 360 : result;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function wrapAngle(radians) {
  const twoPi = Math.PI * 2;
  const wrapped = radians % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

function normalizeRadians(value) {
  const twoPi = Math.PI * 2;
  const result = value % twoPi;
  return result < 0 ? result + twoPi : result;
}

function formatRa(hours) {
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${Math.round(rounded)}h`;
  }
  return `${rounded.toFixed(1)}h`;
}

function formatDec(degrees) {
  const absValue = Math.abs(degrees);
  const prefix = degrees > 0 ? '+' : degrees < 0 ? '-' : '';
  const rounded = Math.round(absValue);
  return `${prefix}${Number.isInteger(absValue) ? absValue : rounded}°`;
}

function setZoom(nextZoom) {
  const clamped = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  const rounded = Math.round(clamped * 100) / 100;
  state.zoomFactor = rounded;
  if (zoomInput) {
    zoomInput.value = rounded.toString();
  }
  reRenderIfPossible();
}

function solveKepler(meanAnomalyRad, eccentricity) {
  let E = meanAnomalyRad;
  let delta;
  do {
    delta = (E - eccentricity * Math.sin(E) - meanAnomalyRad) / (1 - eccentricity * Math.cos(E));
    E -= delta;
  } while (Math.abs(delta) > 1e-6);
  return E;
}

function eclipticToEquatorialVector(vector) {
  const cosEpsilon = Math.cos(OBLIQUITY_RAD);
  const sinEpsilon = Math.sin(OBLIQUITY_RAD);
  const { x, y, z } = vector;
  return {
    x: x,
    y: y * cosEpsilon - z * sinEpsilon,
    z: y * sinEpsilon + z * cosEpsilon,
  };
}

function vectorToRaDec(vector) {
  const { x, y, z } = vector;
  const distance = Math.sqrt(x * x + y * y + z * z) || 1;
  const raRad = Math.atan2(y, x);
  const decRad = Math.asin(z / distance);
  const raHours = normalizeDegrees((raRad * 180) / Math.PI) / 15;
  const decDeg = (decRad * 180) / Math.PI;
  return { raHours, decDeg, distance }; // distance in same units as input
}

function computePlanetHeliocentricPosition(elements, daysSinceJ2000) {
  const a = elements.semiMajorAxisAU;
  const e = elements.eccentricity;
  const iRad = degreesToRadians(elements.inclinationDeg);
  const omegaRad = degreesToRadians(elements.longitudeAscendingNodeDeg);
  const perihelionRad = degreesToRadians(elements.longitudePerihelionDeg);
  const meanLongitudeDeg = elements.meanLongitudeDeg + elements.meanMotionDegPerDay * daysSinceJ2000;
  const meanLongitudeRad = degreesToRadians(normalizeDegrees(meanLongitudeDeg));
  const argumentOfPerihelion = perihelionRad - omegaRad;
  const meanAnomalyRad = normalizeRadians(meanLongitudeRad - perihelionRad);
  const eccentricAnomaly = solveKepler(meanAnomalyRad, e);
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - e) * Math.cos(eccentricAnomaly / 2)
  );
  const distance = a * (1 - e * Math.cos(eccentricAnomaly));

  const u = trueAnomaly + argumentOfPerihelion;
  const cosOmega = Math.cos(omegaRad);
  const sinOmega = Math.sin(omegaRad);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  const x = distance * (cosOmega * cosU - sinOmega * sinU * cosI);
  const y = distance * (sinOmega * cosU + cosOmega * sinU * cosI);
  const z = distance * (sinU * sinI);

  return { x, y, z, distance }; // AU
}

function computeSolarSystemBodies(date) {
  const daysSinceJ2000 = dateToJulian(date) - 2451545.0;

  const earthHelio = computePlanetHeliocentricPosition(EARTH_ORBIT, daysSinceJ2000);
  const earthEclipticVector = { x: earthHelio.x, y: earthHelio.y, z: earthHelio.z };
  const sunEclipticVector = { x: -earthHelio.x, y: -earthHelio.y, z: -earthHelio.z };

  const sunEquatorial = vectorToRaDec(eclipticToEquatorialVector(sunEclipticVector));
  const sunEclipticLongitudeDeg = normalizeDegrees((Math.atan2(sunEclipticVector.y, sunEclipticVector.x) * 180) / Math.PI);

  const planets = PLANETS.map((planet) => {
    const helio = computePlanetHeliocentricPosition(planet.elements, daysSinceJ2000);
    const geoVector = {
      x: helio.x - earthHelio.x,
      y: helio.y - earthHelio.y,
      z: helio.z - earthHelio.z,
    };
    const equatorialVector = eclipticToEquatorialVector(geoVector);
    const equatorial = vectorToRaDec(equatorialVector);
    const eclipticLongitudeDeg = normalizeDegrees((Math.atan2(geoVector.y, geoVector.x) * 180) / Math.PI);
    return {
      name: planet.name,
      displayName: planet.displayName,
      color: planet.color,
      size: planet.size,
      icon: planet.icon,
      raHours: equatorial.raHours,
      decDeg: equatorial.decDeg,
      distanceAU: Math.abs(equatorial.distance),
      eclipticLongitudeDeg,
    };
  });

  return {
    sun: {
      raHours: sunEquatorial.raHours,
      decDeg: sunEquatorial.decDeg,
      eclipticLongitudeDeg: sunEclipticLongitudeDeg,
    },
    earthEclipticVector,
    planets,
  };
}

function dateToJulian(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function greenwichSiderealTime(date) {
  const jd = dateToJulian(date); // Julian Day
  const t = (jd - 2451545.0) / 36525; // Julian centuries since J2000.0
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  return normalizeDegrees(gmst);
}

function localSiderealTime(date, longitude) {
  const gst = greenwichSiderealTime(date);
  return normalizeDegrees(gst + longitude);
}

function equatorialToHorizontal(star, latitude, longitude, date) {
  const lstDeg = localSiderealTime(date, longitude);
  const hourAngleDeg = normalizeDegrees(lstDeg - star.raHours * 15);
  const haRad = degreesToRadians(hourAngleDeg);
  const decRad = degreesToRadians(star.decDeg);
  const latRad = degreesToRadians(latitude);

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altitude = Math.asin(sinAlt);

  const denominator = Math.cos(altitude) * Math.cos(latRad);
  const cosAzRaw =
    (Math.sin(decRad) - Math.sin(altitude) * Math.sin(latRad)) /
    (denominator || Number.EPSILON);
  const sinAzRaw =
    (-Math.cos(decRad) * Math.sin(haRad)) / (Math.cos(altitude) || Number.EPSILON);

  const cosAz = Math.min(1, Math.max(-1, cosAzRaw));
  const sinAz = Math.min(1, Math.max(-1, sinAzRaw));

  let azimuth = Math.atan2(sinAz, cosAz);
  if (azimuth < 0) {
    azimuth += 2 * Math.PI;
  }

  return {
    altitude,
    azimuth,
  };
}

function prepareCanvas() {
  const container = skyContainer || document.querySelector('.sky-container');
  const availableHeight = window.innerHeight - (container?.offsetTop ?? 0) - 80;
  const size = Math.min(container?.clientWidth ?? canvas.width, availableHeight);
  const minSize = 320;
  const finalSize = Math.max(minSize, size || minSize);
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${finalSize}px`;
  canvas.style.height = `${finalSize}px`;
  canvas.width = finalSize * dpr;
  canvas.height = finalSize * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const baseRadius = (finalSize / 2) * 0.92;
  const radius = baseRadius * state.zoomFactor;

  return {
    size: finalSize,
    radius,
    baseRadius,
    center: {
      x: finalSize / 2,
      y: finalSize / 2,
    },
  };
}

function computeMoonState(date, sunEclipticLongitudeDeg) {
  const jd = dateToJulian(date);
  const T = (jd - 2451545.0) / 36525;
  const daysSinceEpoch = jd - 2451545.0;

  const Lprime = degreesToRadians(normalizeDegrees(218.3164477 + 13.17639648 * daysSinceEpoch));
  const D = degreesToRadians(normalizeDegrees(297.8501921 + 12.19074912 * daysSinceEpoch));
  const M = degreesToRadians(normalizeDegrees(357.5291092 + 0.98560028 * daysSinceEpoch));
  const Mprime = degreesToRadians(normalizeDegrees(134.9633964 + 13.06499295 * daysSinceEpoch));
  const F = degreesToRadians(normalizeDegrees(93.2720950 + 13.22935024 * daysSinceEpoch));
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;

  const lonRadians =
    Lprime +
    degreesToRadians(
      6.289 * Math.sin(Mprime) +
        1.274 * Math.sin(2 * D - Mprime) +
        0.658 * Math.sin(2 * D) +
        0.214 * Math.sin(2 * Mprime) +
        0.11 * Math.sin(D)
    ) -
    degreesToRadians(0.186 * E * Math.sin(M)) -
    degreesToRadians(0.059 * Math.sin(2 * D - 2 * Mprime)) -
    degreesToRadians(0.057 * Math.sin(2 * D - M - Mprime)) +
    degreesToRadians(0.053 * Math.sin(2 * D + Mprime)) +
    degreesToRadians(0.046 * Math.sin(2 * D - M)) +
    degreesToRadians(0.041 * Math.sin(M - Mprime));

  const latRadians = degreesToRadians(
    5.128 * Math.sin(F) +
      0.280 * Math.sin(Mprime + F) +
      0.277 * Math.sin(Mprime - F) +
      0.173 * Math.sin(2 * D - F) +
      0.055 * Math.sin(2 * D + F - Mprime) +
      0.046 * Math.sin(2 * D - F - Mprime)
  );

  const distanceKm =
    385000.56 -
    20905.355 * Math.cos(Mprime) -
    3699.111 * Math.cos(2 * D - Mprime) -
    2955.968 * Math.cos(2 * D) -
    569.925 * Math.cos(2 * Mprime);

  const cosLat = Math.cos(latRadians);
  const x = cosLat * Math.cos(lonRadians);
  const y = cosLat * Math.sin(lonRadians);
  const z = Math.sin(latRadians);

  const equatorialVector = eclipticToEquatorialVector({ x, y, z });
  const equatorial = vectorToRaDec(equatorialVector);

  const moonEclipticLongitudeDeg = normalizeDegrees((lonRadians * 180) / Math.PI);
  const phaseAngleRad = degreesToRadians(
    normalizeDegrees(moonEclipticLongitudeDeg - sunEclipticLongitudeDeg)
  );
  const illumination = (1 - Math.cos(phaseAngleRad)) / 2;
  const waxing = normalizeDegrees(moonEclipticLongitudeDeg - sunEclipticLongitudeDeg) < 180;

  return {
    raHours: equatorial.raHours,
    decDeg: equatorial.decDeg,
    distanceKm,
    eclipticLongitudeDeg: moonEclipticLongitudeDeg,
    phaseAngleRad,
    illumination,
    waxing,
  };
}

function drawHorizon(ctxHelpers) {
  const { center, radius } = ctxHelpers;
  const horizonPath = new Path2D();
  let moved = false;
  const stepDeg = 3;

  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const azimuth = degreesToRadians(deg);
    const point = projectHorizontalToCanvas(
      ctxHelpers,
      { azimuth, altitude: 0 },
      { allowBehind: true }
    );
    if (!point) {
      continue;
    }

    if (!moved) {
      horizonPath.moveTo(point.x, point.y);
      moved = true;
    } else {
      horizonPath.lineTo(point.x, point.y);
    }
  }

  if (moved) {
    horizonPath.closePath();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 235, 59, 0.85)';
  ctx.lineWidth = 2.2;
  if (moved) {
    ctx.stroke(horizonPath);
  } else {
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCompass(ctxHelpers) {
  const { center, radius } = ctxHelpers;
  const orientation = state.orientationRad;
  const directions = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: Math.PI / 2 },
    { label: 'S', angle: Math.PI },
    { label: 'W', angle: (3 * Math.PI) / 2 },
  ];

  ctx.fillStyle = 'rgba(200, 215, 255, 0.8)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  directions.forEach(({ label, angle }) => {
    const rotatedAngle = angle + orientation;
    const x = center.x + Math.sin(rotatedAngle) * (radius + 16);
    const y = center.y - Math.cos(rotatedAngle) * (radius + 16);
    ctx.fillText(label, x, y);
  });
}

function magnitudeToSize(magnitude) {
  if (!Number.isFinite(magnitude)) {
    return 1.5;
  }
  const base = 5 - magnitude;
  return Math.max(1, base * 0.9);
}

function applyViewTransform(coords) {
  const orientation = state.orientationRad;
  const pitch = state.pitchRad;

  const sinAlt = Math.sin(coords.altitude);
  const cosAlt = Math.cos(coords.altitude);
  const sinAz = Math.sin(coords.azimuth);
  const cosAz = Math.cos(coords.azimuth);

  const east = cosAlt * sinAz;
  const north = cosAlt * cosAz;
  const up = sinAlt;

  const cosYaw = Math.cos(orientation);
  const sinYaw = Math.sin(orientation);
  const eastYaw = east * cosYaw + north * sinYaw;
  const northYaw = -east * sinYaw + north * cosYaw;
  const upYaw = up;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const northPitch = northYaw * cosPitch - upYaw * sinPitch;
  const upPitch = northYaw * sinPitch + upYaw * cosPitch;
  const eastPitch = eastYaw;

  const altitude = Math.asin(Math.max(-1, Math.min(1, upPitch)));
  const azimuth = Math.atan2(eastPitch, northPitch);

  return {
    altitude,
    azimuth,
  };
}

function projectHorizontalToCanvas(ctxHelpers, coords, options = {}) {
  const { center, radius } = ctxHelpers;
  const transformed = applyViewTransform(coords);
  const maxAltitude = Math.PI / 2;
  const EPSILON = 0.0001;
  const allowBehind = options.allowBehind ?? false;

  if (!allowBehind && transformed.altitude <= -EPSILON) {
    return null;
  }

  const minAltitude = allowBehind ? -maxAltitude + EPSILON : EPSILON;
  const altitudeClamped = Math.min(maxAltitude - EPSILON, Math.max(transformed.altitude, minAltitude));
  const altitudeOffset = maxAltitude - altitudeClamped;
  const normalized = altitudeOffset / maxAltitude;
  const starRadius = normalized * radius;

  const azimuth = transformed.azimuth;
  const x = center.x + Math.sin(azimuth) * starRadius;
  const y = center.y - Math.cos(azimuth) * starRadius;

  return { x, y };
}

function placeLabelOutsideCircle(point, center, radius, offset = 12) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy) || 1;
  const scale = (radius + offset) / distance;
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function drawStar(ctxHelpers, star, coords) {
  const point = projectHorizontalToCanvas(ctxHelpers, coords);
  if (!point) {
    return null;
  }

  const { x, y } = point;

  const size = magnitudeToSize(star.mag);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(150, 190, 255, 0)');

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(x, y, size, 0, 2 * Math.PI);
  ctx.fill();

  return { x, y, size };
}

function projectConstellation(
  constellation,
  ctxHelpers,
  latitude,
  longitude,
  observationDate,
  visibleStars
) {
  const firstLine = constellation.lines?.[0];
  const firstVertex = firstLine?.[0];

  const segments = [];
  const visiblePoints = [];

  const usesCoordinateVertices =
    firstVertex && typeof firstVertex === 'object' && Number.isFinite(firstVertex.raHours);

  if (usesCoordinateVertices) {
    (constellation.lines || []).forEach((line) => {
      let currentSegment = [];
      line.forEach((vertex) => {
        const coords = equatorialToHorizontal(vertex, latitude, longitude, observationDate);
        const point = projectHorizontalToCanvas(ctxHelpers, coords);
        if (point) {
          currentSegment.push(point);
          visiblePoints.push(point);
        } else if (currentSegment.length > 1) {
          segments.push(currentSegment);
          currentSegment = [];
        } else {
          currentSegment = [];
        }
      });
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
    });
  } else {
    (constellation.lines || []).forEach((line) => {
      const points = [];
      line.forEach((name) => {
        const entry = visibleStars?.get(name);
        if (entry?.point) {
          points.push(entry.point);
        }
      });
      if (points.length >= 2) {
        segments.push(points);
        visiblePoints.push(...points);
      }
    });
  }

  let labelPoint = null;
  if (constellation.label && usesCoordinateVertices) {
    const labelHorizontal = equatorialToHorizontal(
      constellation.label,
      latitude,
      longitude,
      observationDate
    );
    labelPoint = projectHorizontalToCanvas(ctxHelpers, labelHorizontal);
  } else if (!labelPoint && visiblePoints.length > 0) {
    const sum = visiblePoints.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
      }),
      { x: 0, y: 0 }
    );
    labelPoint = {
      x: sum.x / visiblePoints.length,
      y: sum.y / visiblePoints.length,
    };
  }

  return { segments, visiblePoints, labelPoint };
}

function drawConstellations(ctxHelpers, projectedConstellations) {
  if (!Array.isArray(projectedConstellations) || projectedConstellations.length === 0) {
    return;
  }
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(154, 213, 255, 0.55)';
  ctx.shadowColor = 'rgba(120, 180, 255, 0.35)';
  ctx.shadowBlur = 7;

  projectedConstellations.forEach(({ projection }) => {
    projection.segments.forEach((segment) => {
      if (segment.length < 2) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(segment[0].x, segment[0].y);
      segment.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  });

  ctx.restore();
}

function drawConstellationLabels(ctxHelpers, projectedConstellations) {
  if (!Array.isArray(projectedConstellations) || projectedConstellations.length === 0) {
    return;
  }
  ctx.save();
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(190, 220, 255, 0.85)';
  ctx.shadowColor = 'rgba(10, 20, 40, 0.9)';
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const { center, radius } = ctxHelpers;

  projectedConstellations.forEach(({ data, projection }) => {
    const candidates = projection.labelPoint
      ? [projection.labelPoint]
      : projection.visiblePoints;
    if (!candidates || candidates.length === 0) {
      return;
    }

    const sum = candidates.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
      }),
      { x: 0, y: 0 }
    );

    const labelPoint = {
      x: sum.x / candidates.length,
      y: sum.y / candidates.length,
    };

    const distanceFromCenter = Math.hypot(labelPoint.x - center.x, labelPoint.y - center.y);
    if (distanceFromCenter > radius * 0.98) {
      return;
    }

    ctx.fillText(data.name, labelPoint.x, labelPoint.y);
  });

  ctx.restore();
}

function drawMessierIcon(point, type) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(180, 210, 255, 0.85)';
  ctx.fillStyle = 'rgba(140, 190, 255, 0.3)';
  let radius = 9;

  switch (type) {
    case 'galaxy':
      ctx.rotate(0.65);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 2.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(210, 190, 255, 0.75)';
      ctx.stroke();
      radius = 11;
      break;
    case 'open_cluster':
      ctx.strokeStyle = 'rgba(160, 220, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      radius = 9;
      break;
    case 'globular_cluster':
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 220, 255, 0.8)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      radius = 8;
      break;
    case 'planetary_nebula':
      ctx.strokeStyle = 'rgba(170, 230, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      radius = 8;
      break;
    case 'supernova_remnant':
      ctx.strokeStyle = 'rgba(255, 200, 160, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI / 4) * i;
        const length = i % 2 === 0 ? 9 : 5;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      }
      ctx.stroke();
      radius = 10;
      break;
    case 'nebula':
    default:
      ctx.fillStyle = 'rgba(180, 140, 255, 0.25)';
      ctx.strokeStyle = 'rgba(220, 180, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3.4, -0.4, 0, Math.PI * 2);
      ctx.stroke();
      radius = 10;
      break;
  }

  ctx.restore();
  return radius;
}

function drawMessierObjects(ctxHelpers, latitude, longitude, observationDate) {
  const rendered = [];

  MESSIER_OBJECTS.forEach((object) => {
    const coords = equatorialToHorizontal(object, latitude, longitude, observationDate);
    const point = projectHorizontalToCanvas(ctxHelpers, coords);
    if (!point) {
      return;
    }
    const radius = drawMessierIcon(point, object.type);

    rendered.push({
      kind: 'messier',
      designation: object.designation,
      name: object.name,
      objectType: object.type,
      raHours: object.raHours,
      decDeg: object.decDeg,
      x: point.x,
      y: point.y,
      radius: radius + 4,
    });
  });

  return rendered;
}

function drawSunIcon(ctxHelpers, horizontalCoords) {
  const point = projectHorizontalToCanvas(ctxHelpers, horizontalCoords);
  if (!point) {
    return null;
  }
  const radius = 11 * state.zoomFactor;
  ctx.save();
  ctx.beginPath();
  const gradient = ctx.createRadialGradient(point.x, point.y, radius * 0.2, point.x, point.y, radius);
  gradient.addColorStop(0, 'rgba(255, 245, 170, 0.95)');
  gradient.addColorStop(0.6, 'rgba(255, 200, 40, 0.95)');
  gradient.addColorStop(1, 'rgba(255, 153, 0, 0.2)');
  ctx.fillStyle = gradient;
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return { point, radius };
}

function drawPlanetIcon(ctxHelpers, horizontalCoords, planet) {
  const point = projectHorizontalToCanvas(ctxHelpers, horizontalCoords);
  if (!point) {
    return null;
  }
  const baseSize = planet.size * state.zoomFactor;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.beginPath();
  ctx.fillStyle = planet.color;
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.35)';
  ctx.lineWidth = 1;

  switch (planet.icon) {
    case 'banded':
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180, 120, 60, 0.6)';
      ctx.lineWidth = 1.4;
      for (let offset = -baseSize * 0.5; offset <= baseSize * 0.5; offset += baseSize * 0.4) {
        ctx.beginPath();
        ctx.moveTo(-baseSize, offset);
        ctx.lineTo(baseSize, offset);
        ctx.stroke();
      }
      break;
    case 'ring':
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.rotate(0.5);
      ctx.strokeStyle = 'rgba(220, 210, 180, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, baseSize * 1.6, baseSize * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    case 'glow':
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 230, 0.45)';
      ctx.arc(0, 0, baseSize * 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'circle':
    default:
      ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }

  ctx.restore();
  return { point, radius: baseSize };
}

function describeMoonPhaseName(illumination, waxing) {
  const percent = illumination * 100;
  if (percent < 1) {
    return 'New Moon';
  }
  if (percent < 45) {
    return waxing ? 'Waxing Crescent' : 'Waning Crescent';
  }
  if (percent < 55) {
    return waxing ? 'First Quarter' : 'Last Quarter';
  }
  if (percent < 95) {
    return waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
  }
  return 'Full Moon';
}

function drawMoonIcon(ctxHelpers, moonHorizontal, sunHorizontal, moonState) {
  const centerPoint = projectHorizontalToCanvas(ctxHelpers, moonHorizontal);
  if (!centerPoint) {
    return null;
  }
  const sunPoint = projectHorizontalToCanvas(ctxHelpers, sunHorizontal, { allowBehind: true });
  const radius = 10 * state.zoomFactor;

  ctx.save();
  ctx.translate(centerPoint.x, centerPoint.y);

  ctx.fillStyle = 'rgba(246, 245, 236, 0.95)';
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const illumination = moonState.illumination;
  const phaseOffset = Math.max(-radius, Math.min(radius, (2 * illumination - 1) * radius));
  const dx = sunPoint.x - centerPoint.x;
  const dy = sunPoint.y - centerPoint.y;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.arc(phaseOffset, 0, radius, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12, 14, 25, 0.92)';
  ctx.fill();
  ctx.restore();

  ctx.restore();

  return { point: centerPoint, radius };
}

function updateInteractiveItems(items) {
  interactiveItems = items;
  if (!state.showStarTooltips) {
    hideTooltip();
  }
}

function describeInteractiveItem(item) {
  if (!item) {
    return null;
  }

  if (item.kind === 'star') {
    const text = formatStarTooltip(item);
    return {
      html: `<div class="tooltip-text">${escapeHtml(text)}</div>`,
      ariaLabel: text,
    };
  }

  if (item.kind === 'messier') {
    const label = MESSIER_TYPE_LABELS[item.objectType] || 'Deep-sky object';
    const text = item.name
      ? `${item.designation} • ${item.name} (${label})`
      : `${item.designation} (${label})`;
    const imageUrl = buildMessierImageUrl(item);
    const htmlParts = [`<div class="tooltip-text">${escapeHtml(text)}</div>`];
    if (imageUrl) {
      const alt = `${item.designation} preview`;
      htmlParts.push(
        `<img src="${imageUrl}" alt="${escapeHtml(alt)}" width="256" height="256" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
      );
    }
    return {
      html: htmlParts.join(''),
      ariaLabel: text,
    };
  }

  if (item.kind === 'planet') {
    const text = `${item.displayName} • alt ${item.altitudeDeg.toFixed(1)}° • ${item.distanceAU.toFixed(2)} AU`;
    const htmlParts = [`<div class="tooltip-text">${escapeHtml(text)}</div>`];
    const imageUrl = buildPlanetImageUrl(item);
    if (imageUrl) {
      const alt = `${item.displayName} preview`;
      htmlParts.push(
        `<img src="${imageUrl}" alt="${escapeHtml(alt)}" width="256" height="256" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
      );
    }
    return {
      html: htmlParts.join(''),
      ariaLabel: text,
    };
  }

  if (item.kind === 'sun') {
    const text = `Sun • alt ${item.altitudeDeg.toFixed(1)}°`;
    const htmlParts = [`<div class="tooltip-text">${escapeHtml(text)}</div>`];
    const imageUrl = buildPlanetImageUrl({ displayName: 'Sun' });
    if (imageUrl) {
      const alt = `${item.displayName || 'Sun'} preview`;
      htmlParts.push(
        `<img src="${imageUrl}" alt="${escapeHtml(alt)}" width="256" height="256" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
      );
    }
    return {
      html: htmlParts.join(''),
      ariaLabel: text,
    };
  }

  if (item.kind === 'moon') {
    const distance = item.distanceKm ? `${(item.distanceKm / 1000).toFixed(0)}k km` : '';
    const text = `${item.displayName} • ${item.phaseName} (${Math.round(
      item.illumination * 100
    )}% lit) • alt ${item.altitudeDeg.toFixed(1)}°${distance ? ` • ${distance}` : ''}`;
    const htmlParts = [`<div class="tooltip-text">${escapeHtml(text)}</div>`];
    const imageUrl = buildPlanetImageUrl({ displayName: 'Moon' });
    if (imageUrl) {
      const alt = `${item.displayName} preview`;
      htmlParts.push(
        `<img src="${imageUrl}" alt="${escapeHtml(alt)}" width="256" height="256" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
      );
    }
    return {
      html: htmlParts.join(''),
      ariaLabel: text,
    };
  }

  return null;
}

function hideTooltip() {
  if (!tooltip) {
    return;
  }
  tooltip.style.opacity = 0;
  tooltip.innerHTML = '';
  tooltip.removeAttribute('aria-label');
}

function showTooltip(content, clientX, clientY) {
  if (!tooltip || !skyContainer || !content) {
    return;
  }

  tooltip.innerHTML = content.html || '';
  if (content.ariaLabel) {
    tooltip.setAttribute('aria-label', content.ariaLabel);
  } else {
    tooltip.removeAttribute('aria-label');
  }
  const containerRect = skyContainer.getBoundingClientRect();
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  tooltip.style.left = `${localX}px`;
  tooltip.style.top = `${localY}px`;
  tooltip.style.opacity = 1;
}

function handleCanvasMove(event) {
  if (isRotating) {
    hideTooltip();
    return;
  }
  if (!state.showStarTooltips || !tooltip || interactiveItems.length === 0) {
    hideTooltip();
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let bestItem = null;
  let bestDistance = Infinity;

  interactiveItems.forEach((item) => {
    const radius = item.radius ?? 10;
    const distance = Math.hypot(x - item.x, y - item.y);
    if (distance <= radius && distance < bestDistance) {
      bestItem = item;
      bestDistance = distance;
    }
  });

  if (bestItem) {
    const description = describeInteractiveItem(bestItem);
    if (description?.html) {
      showTooltip(description, event.clientX, event.clientY);
      return;
    }
  }

  hideTooltip();
}

function handleCanvasLeave() {
  hideTooltip();
}

function handleCanvasPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  isRotating = true;
  activePointerId = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(event.pointerId);
  }
}

function handleCanvasPointerMove(event) {
  if (!isRotating || event.pointerId !== activePointerId) {
    return;
  }
  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  state.orientationRad = wrapAngle(state.orientationRad + deltaX * ORIENTATION_SENSITIVITY);
  const nextPitch = state.pitchRad - deltaY * PITCH_SENSITIVITY;
  state.pitchRad = clamp(nextPitch, PITCH_MIN, PITCH_MAX);
  reRenderIfPossible();
}

function handleCanvasPointerUp(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }
  isRotating = false;
  if (canvas.releasePointerCapture) {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Safe to ignore pointer capture errors (e.g., pointer already released)
    }
  }
  activePointerId = null;
}

function handleCanvasWheel(event) {
  if (!zoomInput) {
    return;
  }
  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  const adjustment = direction * 0.08;
  setZoom(state.zoomFactor + adjustment);
}

function eclipticToEquatorial(lambdaDeg) {
  const lambdaRad = degreesToRadians(lambdaDeg);
  const sinLambda = Math.sin(lambdaRad);
  const cosLambda = Math.cos(lambdaRad);
  const sinEpsilon = Math.sin(OBLIQUITY_RAD);
  const cosEpsilon = Math.cos(OBLIQUITY_RAD);

  const y = sinLambda * cosEpsilon;
  const x = cosLambda;
  const raRad = Math.atan2(y, x);
  const decRad = Math.asin(sinLambda * sinEpsilon);

  const raDeg = normalizeDegrees((raRad * 180) / Math.PI);
  return {
    raHours: raDeg / 15,
    decDeg: (decRad * 180) / Math.PI,
  };
}

function drawEcliptic(ctxHelpers, latitude, longitude, observationDate) {
  ctx.save();
  ctx.strokeStyle = 'rgba(102, 255, 178, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(0, 255, 170, 0.35)';
  ctx.shadowBlur = 8;

  const segments = [];
  let currentSegment = [];

  for (let lambda = 0; lambda <= 360; lambda += 3) {
    const equatorial = eclipticToEquatorial(lambda);
    const coords = equatorialToHorizontal(equatorial, latitude, longitude, observationDate);
    const point = projectHorizontalToCanvas(ctxHelpers, coords);
    if (point) {
      currentSegment.push(point);
    } else if (currentSegment.length > 1) {
      segments.push(currentSegment);
      currentSegment = [];
    } else {
      currentSegment = [];
    }
  }

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  segments.forEach((segment) => {
    ctx.beginPath();
    ctx.moveTo(segment[0].x, segment[0].y);
    segment.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  });

  ctx.restore();
}

function drawEquatorialGrid(ctxHelpers, latitude, longitude, observationDate, raStepHours, decStepDegrees) {
  ctx.save();
  ctx.strokeStyle = 'rgba(160, 210, 255, 0.65)';
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 1;

  const { center, radius } = ctxHelpers;

  const raHours = [];
  const maxRaLines = Math.max(1, Math.floor(24 / raStepHours));
  for (let i = 0; i < maxRaLines; i += 1) {
    const value = i * raStepHours;
    if (value >= 24) {
      break;
    }
    raHours.push(Math.round(value * 100) / 100);
  }
  if (!raHours.includes(0)) {
    raHours.unshift(0);
  }

  const decValues = [];
  const decLimit = 60;
  for (let dec = -decLimit; dec <= decLimit; dec += decStepDegrees) {
    decValues.push(dec);
  }
  decValues.push(-decLimit, decLimit, 0);
  const decDegrees = Array.from(new Set(decValues.map((value) => Math.round(value)))).sort(
    (a, b) => a - b
  );

  const sampleDeclinationStep = 3;
  const sampleRaStep = Math.max(0.25, raStepHours / 2);

  const computeSegments = (samples) => {
    const segments = [];
    const visiblePoints = [];
    let currentSegment = [];

    samples.forEach((sample) => {
      const coords = equatorialToHorizontal(sample, latitude, longitude, observationDate);
      const point = projectHorizontalToCanvas(ctxHelpers, coords);
      if (point) {
        currentSegment.push(point);
        visiblePoints.push({ point, coords });
      } else if (currentSegment.length > 1) {
        segments.push(currentSegment);
        currentSegment = [];
      } else {
        currentSegment = [];
      }
    });

    if (currentSegment.length > 1) {
      segments.push(currentSegment);
    }

    return { segments, visiblePoints };
  };

  const drawSegments = (segments) => {
    segments.forEach((segment) => {
      if (segment.length < 2) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(segment[0].x, segment[0].y);
      segment.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  };

  const raLabels = [];
  ctx.setLineDash([4, 6]);
  raHours.forEach((hour) => {
    const samples = [];
    for (let dec = -80; dec <= 80; dec += sampleDeclinationStep) {
      samples.push({ raHours: hour, decDeg: dec });
    }
    const { segments, visiblePoints } = computeSegments(samples);
    drawSegments(segments);

    const candidate = visiblePoints.reduce((best, entry) => {
      if (!best || entry.coords.altitude < best.coords.altitude) {
        return entry;
      }
      return best;
    }, null);

    if (candidate) {
      raLabels.push({ hour, point: candidate.point });
    }
  });

  const decLabels = [];
  ctx.setLineDash([2, 5]);
  decDegrees.forEach((dec) => {
    const samples = [];
    for (let ra = 0; ra < 24; ra += sampleRaStep) {
      samples.push({ raHours: ra, decDeg: dec });
    }
    const { segments, visiblePoints } = computeSegments(samples);
    drawSegments(segments);

    const candidate = visiblePoints.reduce((best, entry) => {
      if (!best || entry.point.x > best.point.x) {
        return entry;
      }
      return best;
    }, null);

    if (candidate) {
      decLabels.push({ dec, point: candidate.point });
    }
  });

  ctx.setLineDash([]);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(160, 190, 255, 0.75)';
  ctx.textBaseline = 'middle';

  raLabels.forEach(({ hour, point }) => {
    const labelPoint = placeLabelOutsideCircle(point, center, radius, 16);
    ctx.textAlign = 'center';
    ctx.fillText(formatRa(hour), labelPoint.x, labelPoint.y);
  });

  decLabels.forEach(({ dec, point }) => {
    const labelPoint = placeLabelOutsideCircle(point, center, radius, 12);
    const alignLeft = labelPoint.x >= center.x;
    ctx.textAlign = alignLeft ? 'left' : 'right';
    const offset = alignLeft ? 6 : -6;
    ctx.fillText(formatDec(dec), labelPoint.x + offset, labelPoint.y);
  });

  ctx.restore();
}

function centerOnEquatorial(raHours, decDeg, latitude, longitude, observationDate) {
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) {
    return false;
  }

  if (isRendering) {
    return false;
  }

  const horizontal = equatorialToHorizontal({ raHours, decDeg }, latitude, longitude, observationDate);
  const targetOrientation = wrapAngle(-horizontal.azimuth);
  state.orientationRad = targetOrientation;

  const desiredPitch = clamp(Math.PI / 2 - horizontal.altitude, PITCH_MIN, PITCH_MAX);
  state.pitchRad = desiredPitch;

  renderSky();
  return true;
}

function prepareObservationDate() {
  if (state.timeMode === 'now') {
    return new Date();
  }

  if (state.customDate instanceof Date && !Number.isNaN(state.customDate.getTime())) {
    return state.customDate;
  }

  updateFeedback('Invalid custom time provided. Falling back to current time.', true);
  return new Date();
}

function isRenderableLocation(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon);
}

function renderSky() {
  if (isRendering) {
    return;
  }

  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);

  if (!isRenderableLocation(lat, lon)) {
    updateFeedback('Please provide a valid latitude and longitude.', true);
    return;
  }

  isRendering = true;
  try {
    state.latitude = lat;
    state.longitude = lon;

    const observationDate = prepareObservationDate();
    const ctxHelpers = prepareCanvas();

    hideTooltip();

    ctx.fillStyle = '#020412';
    ctx.fillRect(0, 0, ctxHelpers.size, ctxHelpers.size);

    drawHorizon(ctxHelpers);
    drawCompass(ctxHelpers);

    const solarSystem = computeSolarSystemBodies(observationDate);
    const sunHorizontal = equatorialToHorizontal(solarSystem.sun, lat, lon, observationDate);

    if (state.showEquatorialGrid) {
      drawEquatorialGrid(
        ctxHelpers,
        lat,
        lon,
        observationDate,
        state.raStepHours,
        state.decStepDegrees
      );
    }

    drawEcliptic(ctxHelpers, lat, lon, observationDate);

    const visibleStars = new Map();
    const interactive = [];
    let projectedConstellations = [];
    const magnitudeLimit = Number.isFinite(state.maxStarMagnitude)
      ? state.maxStarMagnitude
      : DEFAULT_MAX_MAGNITUDE;

    BRIGHT_STARS.forEach((star) => {
      if (!Number.isFinite(star.raHours) || !Number.isFinite(star.decDeg)) {
        return;
      }

      if (Number.isFinite(star.mag) && star.mag > magnitudeLimit) {
        return;
      }

      const coords = equatorialToHorizontal(star, lat, lon, observationDate);

      const renderedStar = drawStar(ctxHelpers, star, coords);
      if (!renderedStar) {
        return;
      }
      const entry = {
        star,
        coords,
        point: { x: renderedStar.x, y: renderedStar.y },
        size: renderedStar.size,
      };

      const aliases = getStarNameAliases(star);
      if (aliases.length === 0) {
        aliases.push(star.name || (star.hr ? `HR ${star.hr}` : 'Star'));
      }

      const altitudeDeg = (coords.altitude * 180) / Math.PI;
      const displayName = aliases[0];

      interactive.push({
        kind: 'star',
        displayName,
        properName: star.properName,
        bayerDesignation: formatBayerDesignation(star),
        flamsteedDesignation: formatFlamsteedDesignation(star),
        magnitude: star.mag,
        altitudeDeg,
        hr: star.hr,
        x: renderedStar.x,
        y: renderedStar.y,
        radius: Math.max(renderedStar.size + 6, 8),
      });

      aliases.forEach((alias) => {
        if (!visibleStars.has(alias)) {
          visibleStars.set(alias, entry);
        }
      });
    });

    if (state.showConstellations || state.showConstellationLabels) {
      projectedConstellations = CONSTELLATIONS.map((constellation) => ({
        data: constellation,
        projection: projectConstellation(
          constellation,
          ctxHelpers,
          lat,
          lon,
          observationDate,
          visibleStars
        ),
      }));
    }

    if (state.showConstellations) {
      drawConstellations(ctxHelpers, projectedConstellations);
    }

    if (state.showConstellationLabels) {
      drawConstellationLabels(ctxHelpers, projectedConstellations);
    }

    const planetInteractive = [];
    solarSystem.planets.forEach((planet) => {
      const planetHorizontal = equatorialToHorizontal(planet, lat, lon, observationDate);
      const renderInfo = drawPlanetIcon(ctxHelpers, planetHorizontal, planet);
      if (!renderInfo) {
        return;
      }
      planetInteractive.push({
        kind: 'planet',
        displayName: planet.displayName,
        altitudeDeg: (planetHorizontal.altitude * 180) / Math.PI,
        distanceAU: planet.distanceAU,
        x: renderInfo.point.x,
        y: renderInfo.point.y,
        radius: renderInfo.radius + 6,
      });
    });

    const sunAltDeg = (sunHorizontal.altitude * 180) / Math.PI;
    const sunRender = drawSunIcon(ctxHelpers, sunHorizontal);
    if (sunRender) {
      planetInteractive.push({
        kind: 'sun',
        displayName: 'Sun',
        altitudeDeg: sunAltDeg,
        x: sunRender.point.x,
        y: sunRender.point.y,
        radius: sunRender.radius + 8,
      });
    }

    const moonState = computeMoonState(observationDate, solarSystem.sun.eclipticLongitudeDeg);
    const moonHorizontal = equatorialToHorizontal(moonState, lat, lon, observationDate);
    const moonRender = drawMoonIcon(ctxHelpers, moonHorizontal, sunHorizontal, moonState);
    if (moonRender) {
      planetInteractive.push({
        kind: 'moon',
        displayName: 'Moon',
        altitudeDeg: (moonHorizontal.altitude * 180) / Math.PI,
        illumination: moonState.illumination,
        phaseName: describeMoonPhaseName(moonState.illumination, moonState.waxing),
        distanceKm: moonState.distanceKm,
        x: moonRender.point.x,
        y: moonRender.point.y,
        radius: moonRender.radius + 6,
      });
    }

    if (state.showMessierObjects) {
      const messierInteractive = drawMessierObjects(ctxHelpers, lat, lon, observationDate);
      interactive.push(...messierInteractive);
    }

    updateInteractiveItems(interactive.concat(planetInteractive));

    updateFeedback(
      `Sky rendered for lat ${lat.toFixed(2)}°, lon ${lon.toFixed(2)}° at ${observationDate.toUTCString()}`,
      false
    );
  } finally {
    isRendering = false;
  }
}

function applyManualLocation(lat, lon) {
  if (!isRenderableLocation(lat, lon)) {
    updateFeedback('Could not determine a usable location.', true);
    return;
  }

  latInput.value = lat.toFixed(4);
  lonInput.value = lon.toFixed(4);
  updateFeedback(`Location locked at lat ${lat.toFixed(2)}°, lon ${lon.toFixed(2)}°.`);
}

function handleGeolocationSuccess(position) {
  const { latitude, longitude } = position.coords;
  applyManualLocation(latitude, longitude);
  renderSky();
}

function handleGeolocationError(error) {
  let message = 'Unable to obtain your location.';
  switch (error.code) {
    case error.PERMISSION_DENIED:
      message = 'Location permission denied. Please enter coordinates manually.';
      break;
    case error.POSITION_UNAVAILABLE:
      message = 'Location information is unavailable. Enter coordinates manually.';
      break;
    case error.TIMEOUT:
      message = 'Timed out while fetching location. Try again or enter coordinates manually.';
      break;
    default:
      message = 'Unexpected geolocation error. Enter coordinates manually.';
  }
  updateFeedback(message, true);
}

function requestLocation() {
  if (!('geolocation' in navigator)) {
    updateFeedback('Geolocation is not supported in this browser.', true);
    return;
  }

  updateFeedback('Requesting your location…');
  navigator.geolocation.getCurrentPosition(handleGeolocationSuccess, handleGeolocationError, {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 60000,
  });
}

function handleTimeSelectionChange(event) {
  state.timeMode = event.target.value;
  const isCustom = state.timeMode === 'custom';
  timeInputGroup.hidden = !isCustom;
  if (!isCustom) {
    state.customDate = null;
  }
}

function handleCustomTimeInput(event) {
  const value = event.target.value;
  if (!value) {
    state.customDate = null;
    return;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    updateFeedback('Unable to parse the provided datetime. Using current time.', true);
    state.customDate = null;
    return;
  }

  state.customDate = parsed;
}

function handleRaStepInput(event) {
  const rawValue = parseFloat(event.target.value);
  const safeValue = Number.isFinite(rawValue) ? rawValue : DEFAULT_RA_STEP;
  const value = clamp(safeValue, 0.5, 6);
  state.raStepHours = value;
  event.target.value = value.toString();
  if (!state.showEquatorialGrid) {
    return;
  }
  reRenderIfPossible();
}

function handleDecStepInput(event) {
  const rawValue = parseFloat(event.target.value);
  const safeValue = Number.isFinite(rawValue) ? rawValue : DEFAULT_DEC_STEP;
  const value = clamp(safeValue, 10, 30);
  state.decStepDegrees = value;
  event.target.value = value.toString();
  if (!state.showEquatorialGrid) {
    return;
  }
  reRenderIfPossible();
}

function handleZoomInput(event) {
  const rawValue = parseFloat(event.target.value);
  if (!Number.isFinite(rawValue)) {
    return;
  }
  setZoom(rawValue);
}

function handleMaxMagnitudeInput(event) {
  const rawValue = parseFloat(event.target.value);
  if (!Number.isFinite(rawValue)) {
    if (event.type === 'change' || event.type === 'blur') {
      state.maxStarMagnitude = DEFAULT_MAX_MAGNITUDE;
      event.target.value = DEFAULT_MAX_MAGNITUDE.toString();
      reRenderIfPossible();
    }
    return;
  }

  const value = clamp(rawValue, MIN_MAGNITUDE_LIMIT, MAX_MAGNITUDE_LIMIT);
  if (value !== rawValue) {
    event.target.value = value.toString();
  }

  const previous = state.maxStarMagnitude;
  state.maxStarMagnitude = value;
  if (previous !== value) {
    reRenderIfPossible();
  }
}

function handleObjectSearch() {
  if (!searchInput) {
    return;
  }

  const query = searchInput.value.trim();
  if (!query) {
    updateFeedback('Enter an object name to center on.', true);
    return;
  }

  const match = findSearchEntry(query, searchIndex);
  if (!match) {
    updateFeedback(`Could not find "${query}" in the catalog.`, true);
    return;
  }

  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (!isRenderableLocation(lat, lon)) {
    updateFeedback('Provide a valid latitude and longitude before centering on objects.', true);
    return;
  }

  const observationDate = prepareObservationDate();
  const resolved = match.resolve({ observationDate, latitude: lat, longitude: lon });
  if (!resolved || !Number.isFinite(resolved.raHours) || !Number.isFinite(resolved.decDeg)) {
    updateFeedback(`Unable to determine the position of ${match.displayName}.`, true);
    return;
  }

  const centered = centerOnEquatorial(resolved.raHours, resolved.decDeg, lat, lon, observationDate);
  if (!centered) {
    updateFeedback('Sky rendering is already in progress. Try again shortly.', true);
    return;
  }

  updateFeedback(`Centered on ${match.displayName}.`, false);
}

renderButton.addEventListener('click', renderSky);
locationButton.addEventListener('click', requestLocation);
timeSelect.addEventListener('change', handleTimeSelectionChange);
customTimeInput.addEventListener('input', handleCustomTimeInput);

if (constellationsInput) {
  constellationsInput.addEventListener('change', (event) => {
    state.showConstellations = event.target.checked;
    if (isRenderableLocation(state.latitude, state.longitude)) {
      renderSky();
    } else if (event.target.checked) {
      updateFeedback('Constellation overlay will appear once you render the sky.');
    } else {
      updateFeedback('Constellation overlay hidden.');
    }
  });
}

if (equatorialGridInput) {
  equatorialGridInput.addEventListener('change', (event) => {
    state.showEquatorialGrid = event.target.checked;
    if (isRenderableLocation(state.latitude, state.longitude)) {
      renderSky();
    } else if (event.target.checked) {
      updateFeedback('Equatorial grid will show after you render the sky.');
    }
  });
}

if (constellationLabelsInput) {
  constellationLabelsInput.addEventListener('change', (event) => {
    state.showConstellationLabels = event.target.checked;
    reRenderIfPossible();
  });
}

if (starTooltipsInput) {
  starTooltipsInput.addEventListener('change', (event) => {
    state.showStarTooltips = event.target.checked;
    if (!state.showStarTooltips) {
      hideTooltip();
    }
  });
}

if (messierInput) {
  messierInput.addEventListener('change', (event) => {
    state.showMessierObjects = event.target.checked;
    reRenderIfPossible();
  });
}

if (searchButton) {
  searchButton.addEventListener('click', handleObjectSearch);
}

if (searchInput) {
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleObjectSearch();
    }
  });
}

if (maxMagnitudeInput) {
  maxMagnitudeInput.addEventListener('change', handleMaxMagnitudeInput);
  maxMagnitudeInput.addEventListener('input', handleMaxMagnitudeInput);
  maxMagnitudeInput.addEventListener('blur', handleMaxMagnitudeInput);
}

if (raGridInput) {
  raGridInput.addEventListener('change', handleRaStepInput);
  raGridInput.addEventListener('blur', handleRaStepInput);
}

if (decGridInput) {
  decGridInput.addEventListener('change', handleDecStepInput);
  decGridInput.addEventListener('blur', handleDecStepInput);
}

if (zoomInput) {
  zoomInput.addEventListener('input', handleZoomInput);
  zoomInput.addEventListener('change', handleZoomInput);
}

canvas.addEventListener('mousemove', handleCanvasMove);
canvas.addEventListener('mouseleave', handleCanvasLeave);
canvas.addEventListener('pointerdown', handleCanvasPointerDown);
canvas.addEventListener('pointermove', handleCanvasPointerMove);
canvas.addEventListener('pointerup', handleCanvasPointerUp);
canvas.addEventListener('pointercancel', handleCanvasPointerUp);
canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });

window.addEventListener('resize', () => {
  if (isRenderableLocation(state.latitude, state.longitude)) {
    renderSky();
  }
});

// Attempt to pre-fill with geolocation once the user has had a moment to read the UI.
setTimeout(() => {
  if (!latInput.value && !lonInput.value) {
    requestLocation();
  }
}, 600);

setZoom(state.zoomFactor);
updateFeedback('Waiting for location…');
