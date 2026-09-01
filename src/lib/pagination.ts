export function boundedPositiveInt(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}
