// A tiny promise cache (E2.2). Several components independently fetch the same
// read-only resources (plan status, profile) on mount. makeCache shares one
// in-flight/resolved promise across all callers so a burst of mounts triggers a
// single request, and exposes invalidate() so a mutation can force the next read
// to refetch. An optional TTL bounds staleness for long sessions where no
// mutation happens. On rejection the slot is released so one failure doesn't
// poison every future read.
//
// ponytail: coarse module-level cache, not per-key. Ceiling: it dedupes a single
// resource, not a keyed collection. Upgrade path is a React-Query-style layer if
// per-key revalidation is ever needed.

export interface PromiseCache<T> {
  get(): Promise<T>;
  invalidate(): void;
}

export function makeCache<T>(fetcher: () => Promise<T>, ttlMs = 0): PromiseCache<T> {
  let inflight: Promise<T> | null = null;
  let stamp = 0;
  return {
    get() {
      const now = Date.now();
      if (inflight && ttlMs > 0 && now - stamp > ttlMs) inflight = null; // expired
      if (!inflight) {
        stamp = now;
        inflight = fetcher().catch(err => { inflight = null; throw err; }); // release slot on failure
      }
      return inflight;
    },
    invalidate() { inflight = null; },
  };
}
