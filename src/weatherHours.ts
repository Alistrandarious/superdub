// Which hours the weather sheet shows for the day you tapped. The Open-Meteo call
// already returns every hour of the 7-day window, so selecting a day is a filter over
// what we hold, never another request.
export interface WeatherHour { time: string; temp: number; code: number; }

// Today shows a rolling window from the current hour, which is the forecast you
// actually want at a glance; any other day shows that whole calendar day. Open-Meteo
// returns local ISO times ("2026-07-21T14:00"), so matching the date prefix keeps this
// free of time-zone re-parsing. Late in the evening today's window runs past midnight
// into tomorrow, which is the point of a rolling window.
export function hoursForDay(
  all: WeatherHour[], date: string, isToday: boolean, nowMs: number, span = 10,
): WeatherHour[] {
  if (!isToday) return all.filter(h => h.time.slice(0, 10) === date);
  // The hour just gone still counts as "now" until the next one lands. A forecast with
  // nothing left in it shows nothing, rather than replaying its first hours as "now".
  const from = all.findIndex(h => new Date(h.time).getTime() >= nowMs - 3600e3);
  return from < 0 ? [] : all.slice(from, from + span);
}
