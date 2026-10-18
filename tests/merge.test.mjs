// node tests/merge.test.mjs: the shared merge cases (tests/merge-cases), against shared/core.js.
// Memoir for Windows runs the same file against its C# (tests/SyncTests.cs), so the two agree.
import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { mergeDay, cleanDay, anonymizeDay, normalizeDay } from '../shared/core.js';

const cases = JSON.parse(readFileSync(new URL('./merge-cases/merge.json', import.meta.url), 'utf8'));
// a case writes h as {hour: ms}; a day holds all 24 hours
const hours = h => (Array.isArray(h) ? h : Array.from({ length: 24 }, (_, i) => (h && h[i]) || 0));
const day = d => (d ? { ti: {}, th: {}, tu: {}, tp: [], ...d, h: hours(d.h) } : d);

let n = 0;
const check = (got, want, name) => {
  try { deepStrictEqual(got, want); n++; } catch { console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); process.exitCode = 1; }
};
for (const c of cases.merge) check(mergeDay(day(c.a), day(c.b)), day(c.out), `merge: ${c.name}`);
for (const c of cases.clean) check(cleanDay(c.in && { ...c.in, h: Array.isArray(c.in.h) ? c.in.h : hours(c.in.h) }), day(c.out), `clean: ${c.name}`);
for (const c of cases.anonymize) { const rec = normalizeDay(day(c.in)); anonymizeDay(rec, c.list); check(rec, day(c.out), `anonymize: ${c.name}`); }
if (!process.exitCode) console.log(`PASS: ${n} shared merge cases.`);
