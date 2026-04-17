export function getScoreColour(score: number): string {
  if (score <= 3) return "text-red-700";
  if (score <= 6) return "text-amber-700";
  return "text-green-800";
}

export function getScoreBadgeClasses(score: number): string {
  if (score <= 3) return "bg-red-100 text-red-700";
  if (score <= 6) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-800";
}
