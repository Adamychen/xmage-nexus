import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, matchCount, tourneyCount, record, summarize, percentiles } from './ranking.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(here, 'data', 'test-ranking.db');

try {
  fs.rmSync(testDbPath, { force: true });
} catch {
  /* noop */
}

console.log('Testing matchCount and tourneyCount...');
assert.equal(matchCount({ matchHistory: '15 (Q:2)' }), 15);
assert.equal(matchCount({ matchHistory: '0' }), 0);
assert.equal(matchCount({ matchHistory: '' }), 0);
assert.equal(matchCount({}), 0);

assert.equal(tourneyCount({ tourneyHistory: '157 (D:11)' }), 157);
assert.equal(tourneyCount({ tourneyHistory: '0' }), 0);
assert.equal(tourneyCount({ tourneyHistory: '' }), 0);
assert.equal(tourneyCount({}), 0);

console.log('Testing openDb and schema migration...');
const db = openDb(testDbPath);
const cols = db.prepare("PRAGMA table_info(ratings)").all().map(c => c.name);
assert.ok(cols.includes('tourneys'), 'ratings table must have tourneys column');

console.log('Testing percentiles computation...');
const sample = [1200, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200];
const p = percentiles(sample);
assert.equal(p.p50, 1800);
assert.equal(p.max, 2200);

console.log('Testing record and summarize with pure drafter vs pure constructed vs newcomer...');
const now = Date.now();
const testUsers = [
  // Pure drafter (like Tiglat Pileser)
  {
    userName: 'Tiglat',
    constructedRating: 800,
    limitedRating: 1773,
    generalRating: 1740,
    matchHistory: '0',
    tourneyHistory: '157 (D:11)',
  },
  // Pure constructed player
  {
    userName: 'Spike',
    constructedRating: 1850,
    limitedRating: 800,
    generalRating: 1800,
    matchHistory: '120 (Q:3)',
    tourneyHistory: '0',
  },
  // Hybrid active player
  {
    userName: 'Pro',
    constructedRating: 1950,
    limitedRating: 1900,
    generalRating: 1925,
    matchHistory: '200',
    tourneyHistory: '25',
  },
  // Inactive / newcomer with default rating 800
  {
    userName: 'Newbie',
    constructedRating: 800,
    limitedRating: 800,
    generalRating: 800,
    matchHistory: '0',
    tourneyHistory: '0',
  },
];

record(db, testUsers, now);

const summary = summarize(db, now);

// Coverage assertions
assert.equal(summary.coverage.distinctPlayersSeen, 4);

const tiglat = summary.players.find(p => p.user === 'Tiglat');
assert.ok(tiglat, 'Tiglat must exist in summary');
assert.equal(tiglat.tourneys, 157);
assert.equal(tiglat.matches, 0);
assert.equal(tiglat.inPopulationLimited, true, 'Tiglat must be in Limited population');
assert.equal(tiglat.inPopulationConstructed, false, 'Tiglat must not be in Constructed population');
assert.equal(tiglat.inPopulation, true, 'Tiglat must be in overall active population');

const spike = summary.players.find(p => p.user === 'Spike');
assert.ok(spike, 'Spike must exist in summary');
assert.equal(spike.matches, 120);
assert.equal(spike.tourneys, 0);
assert.equal(spike.inPopulationConstructed, true, 'Spike must be in Constructed population');
assert.equal(spike.inPopulationLimited, false, 'Spike must not be in Limited population');

const newbie = summary.players.find(p => p.user === 'Newbie');
assert.ok(newbie);
assert.equal(newbie.inPopulation, false);
assert.equal(newbie.inPopulationConstructed, false);
assert.equal(newbie.inPopulationLimited, false);

// Check that base rating 800 does not pollute the percentiles
// Limited percentiles should only include Tiglat (1773) and Pro (1900)
assert.equal(summary.percentiles.limited.max, 1900);
assert.equal(summary.percentiles.limited.p50, 1900);
// Constructed percentiles should only include Spike (1850) and Pro (1950)
assert.equal(summary.percentiles.constructed.max, 1950);
assert.equal(summary.percentiles.constructed.p50, 1950);

assert.equal(summary.coverage.populationConstructed, 2, 'Constructed population should be 2 (Spike, Pro)');
assert.equal(summary.coverage.populationLimited, 2, 'Limited population should be 2 (Tiglat, Pro)');

db.close();
fs.rmSync(testDbPath, { force: true });

console.log('All ranking.mjs tests passed successfully!');
