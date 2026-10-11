// Social-posting domain logic, shared by the pipeline API (lane membership)
// and the dashboard UI (date input + age-based colour bands). Keeping it in one
// module means the server and the client can never disagree about what counts
// as "needs posting" or which age band a vehicle falls into.

const DAY_MS = 86_400_000;

// Strict, zero-padded calendar date — what a native <input type="date"> emits.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Full ISO-8601 timestamp with an explicit zone (Z or ±hh:mm), e.g. the value
// produced by Date.prototype.toISOString() for a "stamp now" call.
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Age bands for the Needs Posting lane. `red` also covers never-posted. */
export type PostingBand = "neutral" | "yellow" | "orange" | "red";

export type PostingBandStyle = { bg: string; border: string };

// Dark-theme treatments: a translucent tint plus a saturated border, matching
// the original never-posted red (rgba(127,29,29,.35) / #ef4444). Distinct hues
// so the four bands are tellable apart at a glance.
export const POSTING_BAND_STYLES: Record<PostingBand, PostingBandStyle> = {
  red: { bg: "rgba(127,29,29,0.35)", border: "#ef4444" },
  orange: { bg: "rgba(154,52,18,0.35)", border: "#f97316" },
  yellow: { bg: "rgba(113,63,18,0.35)", border: "#eab308" },
  neutral: { bg: "", border: "transparent" },
};

function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/**
 * Validate and normalise a user-supplied posting date. Accepts a calendar date
 * (`YYYY-MM-DD`, anchored at UTC midnight so the picked day is stable
 * regardless of timezone) or an ISO-8601 timestamp with an explicit zone.
 * Anything else — malformed, impossible date, wrong type — is rejected.
 */
export function normalizePostedDate(
  input: unknown,
): { ok: true; iso: string } | { ok: false; error: string } {
  if (typeof input !== "string") {
    return { ok: false, error: "last_posted_at must be a date string" };
  }
  const value = input.trim();
  if (value === "") {
    return { ok: false, error: "last_posted_at must not be empty" };
  }
  if (DATE_ONLY_RE.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    if (!isRealCalendarDate(y, m, d)) {
      return { ok: false, error: `last_posted_at is not a valid date: ${value}` };
    }
    return { ok: true, iso: `${value}T00:00:00.000Z` };
  }
  if (ISO_DATETIME_RE.test(value)) {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) {
      return { ok: false, error: `last_posted_at is not a valid timestamp: ${value}` };
    }
    return { ok: true, iso: dt.toISOString() };
  }
  return {
    ok: false,
    error: `last_posted_at must be YYYY-MM-DD or an ISO-8601 timestamp: ${value}`,
  };
}

/**
 * Whole days between the stored posting date and `now`, using UTC calendar
 * days so a date-only value ("...T00:00:00.000Z") yields the intuitive count.
 */
export function daysSincePosted(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  const thenDay = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((nowDay - thenDay) / DAY_MS);
}

/**
 * Age band for a vehicle: never-posted or 120+ days is red, 70–119 orange,
 * 30–69 yellow, and under 30 days neutral. Future dates (scheduled posts) fall
 * into the neutral band.
 */
export function postingBand(
  lastPostedAt: string | null | undefined,
  now: Date = new Date(),
): PostingBand {
  if (lastPostedAt == null) return "red";
  const days = daysSincePosted(lastPostedAt, now);
  if (days >= 120) return "red";
  if (days >= 70) return "orange";
  if (days >= 30) return "yellow";
  return "neutral";
}

/**
 * True when a vehicle's stored posting date is in the future, i.e. it has been
 * scheduled ahead and must stay out of the Needs Posting lane until that date
 * arrives. Stored values are ISO-8601 UTC (`...Z`), so a lexical compare is the
 * same as a chronological one.
 */
export function isScheduledForFuture(
  lastPostedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (lastPostedAt == null) return false;
  return lastPostedAt > now.toISOString();
}
