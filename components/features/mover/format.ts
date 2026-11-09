/** Display formats shared by the mover workspace. */

export function formatMoney(amount: number, currency = 'TND'): string {
  const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(amount);
  return `${value} ${currency}`;
}

export function formatDuration(hours: number): string {
  const minutes = Math.max(0, Math.round(hours * 60));
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (whole === 0) return `${rest} min`;
  return rest === 0 ? `${whole}h` : `${whole}h ${String(rest).padStart(2, '0')}m`;
}
