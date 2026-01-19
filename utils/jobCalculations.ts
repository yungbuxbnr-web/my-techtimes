
export function awToMinutes(aw: number): number {
  return aw * 5;
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function validateWipNumber(wip: string): boolean {
  return /^\d{5}$/.test(wip);
}

export function validateAW(aw: number): boolean {
  return aw >= 0 && aw <= 100 && Number.isInteger(aw);
}
