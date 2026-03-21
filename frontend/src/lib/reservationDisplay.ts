export function formatReservationDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed || '未入力';
}