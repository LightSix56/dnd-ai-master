/**
 * Safely parses a D&D 5e Challenge Rating string (e.g. "1/8", "1/4", "1/2", "5")
 * without using eval() or arbitrary expression execution.
 */
export function parseChallengeRating(cr: string | number | null | undefined): number {
  if (typeof cr === "number") {
    return Number.isFinite(cr) && cr >= 0 ? cr : NaN;
  }
  const raw = String(cr ?? "").trim();
  if (!raw) return NaN;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }
  const frac = raw.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den === 0) return NaN;
    return num / den;
  }
  return NaN;
}
