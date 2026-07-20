// Self-check for the weather sheet's day picker (run: npx tsx src/weatherHours.check.ts).
import assert from 'assert';
import { hoursForDay, type WeatherHour } from './weatherHours';

// Two full local days, on the hour, exactly as Open-Meteo returns them.
const all: WeatherHour[] = ['2026-07-21', '2026-07-22'].flatMap(d =>
  Array.from({ length: 24 }, (_, h) => ({
    time: `${d}T${String(h).padStart(2, '0')}:00`, temp: 20, code: 0,
  })),
);

// A tapped day gives that whole calendar day, whatever the clock says.
const tapped = hoursForDay(all, '2026-07-22', false, new Date('2026-07-21T14:00').getTime());
assert.strictEqual(tapped.length, 24, 'a tapped day shows all 24 hours');
assert.strictEqual(tapped[0].time, '2026-07-22T00:00', 'a tapped day starts at midnight');

// Today starts at the current hour, not at midnight.
const today = hoursForDay(all, '2026-07-21', true, new Date('2026-07-21T14:00').getTime());
assert.strictEqual(today.length, 10, 'today shows a 10 hour window');
assert.strictEqual(today[0].time, '2026-07-21T13:00', 'the hour just gone is still "now"');

// Late in the evening the rolling window runs past midnight into tomorrow.
const evening = hoursForDay(all, '2026-07-21', true, new Date('2026-07-21T20:00').getTime());
assert.strictEqual(evening.length, 10, 'the window does not truncate at midnight');
assert.strictEqual(evening[9].time, '2026-07-22T04:00', 'it carries on into the next day');

// Past the end of the forecast there is nothing left to slice, and that must not throw.
const stale = hoursForDay(all, '2026-07-30', true, new Date('2026-07-30T09:00').getTime());
assert.strictEqual(stale.length, 0, 'no future hours → empty, not a crash');

console.log('weatherHours: all checks passed');
