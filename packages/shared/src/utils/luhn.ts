export function isCardNumber(input: string): boolean {
  if (!input) return false;
  // Look for any contiguous sequence of 13-19 digits (with optional spaces or dashes)
  const cleaned = input.replace(/[\s-]/g, '');
  const match = cleaned.match(/\b\d{13,19}\b/) || (cleaned.length >= 13 && cleaned.length <= 19 && /^\d+$/.test(cleaned) ? [cleaned] : null);

  if (!match) return false;

  const digits = match[0];
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
