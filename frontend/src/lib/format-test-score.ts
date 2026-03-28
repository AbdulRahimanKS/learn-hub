/** Test scores are stored as floats; show at least one decimal when whole. */
export function formatTestScorePercent(score: number | string | null | undefined): string {
  if (score === null || score === undefined || score === '') return '—';
  const n = typeof score === 'string' ? parseFloat(score) : Number(score);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(n);
}
