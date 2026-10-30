export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Weak' | 'Okay' | 'Strong password';
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Weak' };
  }

  let score = 0;

  // Criteria 1: At least 8 characters
  const hasLength = password.length >= 8;
  // Criteria 2: Has digits
  const hasDigits = /\d/.test(password);
  // Criteria 3: Has mixed case (lowercase and uppercase)
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  // Criteria 4: Has special symbols
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (hasLength) score++;
  if (hasDigits) score++;
  if (hasMixedCase) score++;
  if (hasSpecial) score++;

  if (score === 0) {
    score = 1;
  }

  let label: 'Weak' | 'Okay' | 'Strong password' = 'Weak';
  if (score <= 1) {
    label = 'Weak';
  } else if (score <= 3) {
    label = 'Okay';
  } else {
    label = 'Strong password';
  }

  return { score, label };
}
