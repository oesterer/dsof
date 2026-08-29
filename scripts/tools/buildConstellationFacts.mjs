import { readFileSync, writeFileSync } from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('Usage: node scripts/tools/buildConstellationFacts.mjs <overview.html>');
}

const html = readFileSync(inputPath, 'utf8');
const clean = (value = '') => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

const facts = {};
const cards = html.split(/<div\s+[^>]*hemisphere="/).slice(1);
for (const card of cards) {
  const sourceName = clean(card.match(/class="constellation-card-title"[^>]*>([\s\S]*?)<\/h3>/)?.[1]);
  const name = sourceName === 'Boötes' ? 'Bootes' : sourceName === 'Chamaeleontis' ? 'Chamaeleon' : sourceName;
  const details = [...card.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].slice(0, 3).map((match) => clean(match[1]));
  if (name && details.length >= 2) {
    facts[name] = {
      symbolism: details.length >= 3 ? details[0] : '',
      hemisphere: details.at(-2),
      visibility: details.at(-1),
    };
  }
}

if (Object.keys(facts).length !== 88) {
  throw new Error(`Expected 88 constellations, found ${Object.keys(facts).length}`);
}

const source = [
  '// Generated from the Star Registration overview of all 88 constellations.',
  '// Source: https://www.star-registration.com/blogs/constellations-and-zodiac-signs/an-overview-of-all-88-constellations',
  `export const CONSTELLATION_FACTS = ${JSON.stringify(facts, null, 2)};`,
  '',
].join('\n');

writeFileSync(new URL('../../data/constellationFacts.js', import.meta.url), source);
