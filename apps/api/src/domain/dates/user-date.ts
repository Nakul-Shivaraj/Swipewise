export interface ClockContext {
  now: Date;
  timeZone: string;
}

export function resolveLocalCalendarDate(_context: ClockContext): string {
  return "";
}
