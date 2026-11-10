/**
 * Formats integer cents as a dollar string with two decimal places (e.g. 400 -> "$4.00").
 * Per AGENTS.md §6, only formatCents() divides by 100 for display.
 */
export function formatCents(cents: number): string {
  const truncated = Math.trunc(cents);
  const sign = truncated < 0 ? "-" : "";
  const abs = Math.abs(truncated);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

/**
 * Parses a user-entered dollar string (e.g. "100", "$100.50", "1,250.25")
 * into whole integer cents without floating-point math.
 * Returns null if the input is not a valid dollar amount.
 * When allowNegative is true, supports negative amounts (e.g. "-50" -> -5000) for refunds.
 */
export function parseDollarsToCents(
  input: string,
  options: { allowNegative?: boolean } = {},
): number | null {
  let cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }

  let isNegative = false;
  if (options.allowNegative && cleaned.startsWith("-")) {
    isNegative = true;
    cleaned = cleaned.slice(1).replace(/^\$/, "").trim();
  }

  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) {
    return null;
  }

  const wholeDollarsStr = match[1] ?? "0";
  const fractionStr = (match[2] ?? "").padEnd(2, "0");

  const wholeDollars = Number.parseInt(wholeDollarsStr, 10);
  const centsPart = Number.parseInt(fractionStr, 10);

  if (!Number.isSafeInteger(wholeDollars) || !Number.isSafeInteger(centsPart)) {
    return null;
  }

  const totalCents = wholeDollars * 100 + centsPart;
  if (!Number.isSafeInteger(totalCents)) {
    return null;
  }

  return isNegative ? -totalCents : totalCents;
}
