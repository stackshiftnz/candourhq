/**
 * Standardized score calculation for Candour HQ.
 * Ensures consistent rounding and averaging across analysis and rescoring.
 */

/**
 * Calculates a signal score (substance, style, or trust) based on its dimensions.
 * Rounds to 1 decimal place.
 */
export function calculateSignalScore(dimensions: Record<string, number>): number {
  const values = Object.values(dimensions);
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Calculates the overall average score from the three signal scores.
 * Rounds to 1 decimal place.
 */
export function calculateAverageScore(substance: number, style: number, trust: number): number {
  return Math.round(((substance + style + trust) / 3) * 10) / 10;
}
