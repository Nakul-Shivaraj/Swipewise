/**
 * SwipeWise - Interactive Client Application Script
 * Features:
 * - 3D Gyroscopic/Cursor Card Tilt & Dynamic Metallic Sheen
 * - Live Form Sync (Cardholder Name)
 * - Dynamic Rewards Portfolio Calculator
 * - Real-Time Password Strength Engine & Rule Checker
 * - Sign-up / Login Mode Switcher
 * - Inline Validation & Accessible Error Messaging
 * - Post-Registration Onboarding Modal
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const form = document.getElementById('formSignup');
  const inputName = document.getElementById('fullName');
  const inputEmail = document.getElementById('email');
  const inputPassword = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const eyeOpen = togglePasswordBtn.querySelector('.eye-open');
  const eyeClosed = togglePasswordBtn.querySelector('.eye-closed');

  const cardContainer = document.getElementById('cardContainer');
  const interactiveCard = document.getElementById('interactiveCard');
  const previewCardholder = document.getElementById('previewCardholder');

  const cardPillGroup = document.getElementById('cardPillGroup');
  const bonusUnlockedEl = document.getElementById('bonusUnlocked');

  const tabSignup = document.getElementById('tabSignup');
  const tabLogin = document.getElementById('tabLogin');
  const authHeading = document.getElementById('authHeading');
  const authSubheading = document.getElementById('authSubheading');
  const groupFullName = document.getElementById('groupFullName');
  const groupCheckboxes = document.getElementById('groupCheckboxes');
  const strengthMeter = document.getElementById('strengthMeter');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const submitSpinner = document.getElementById('submitSpinner');

  const nameError = document.getElementById('nameError');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const termsError = document.getElementById('termsError');
  const chkTerms = document.getElementById('chkTerms');

  const strengthBars = document.querySelector('.strength-bars');
  const strengthStatus = document.getElementById('strengthStatus');
  const reqLength = document.getElementById('reqLength');
  const reqUpper = document.getElementById('reqUpper');
  const reqNumber = document.getElementById('reqNumber');
  const reqSpecial = document.getElementById('reqSpecial');

  const successModal = document.getElementById('successModal');
  const summaryEmail = document.getElementById('summaryEmail');
  const summaryBonus = document.getElementById('summaryBonus');
  const btnDashboard = document.getElementById('btnDashboard');
  const btnResetModal = document.getElementById('btnResetModal');

  const btnGoogle = document.getElementById('btnGoogleAuth');
  const btnApple = document.getElementById('btnAppleAuth');

  let currentMode = 'signup'; // 'signup' or 'login'

  // ==========================================================================
  // 1. 3D Credit Card Dynamic Tilt Effect
  // ==========================================================================
  if (cardContainer && interactiveCard) {
    cardContainer.addEventListener('mousemove', (e) => {
      const rect = cardContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      interactiveCard.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;

      const sheen = interactiveCard.querySelector('.card-glass-sheen');
      if (sheen) {
        sheen.style.transform = `translate(${(x - centerX) * 0.4}px, ${(y - centerY) * 0.4}px)`;
      }
    });

    cardContainer.addEventListener('mouseleave', () => {
      interactiveCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      const sheen = interactiveCard.querySelector('.card-glass-sheen');
      if (sheen) {
        sheen.style.transform = 'translate(0, 0)';
      }
    });
  }

  // ==========================================================================
  // 2. Real-time Name Mirroring to Card Preview
  // ==========================================================================
  if (inputName && previewCardholder) {
    inputName.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      previewCardholder.textContent = val ? val.toUpperCase() : 'YOUR NAME';
    });
  }

  // ==========================================================================
  // 3. Rewards Portfolio Calculator
  // ==========================================================================
  function updateEstimatedRewards() {
    let totalBonus = 0;
    const activeChips = cardPillGroup.querySelectorAll('.card-chip.active');
    activeChips.forEach(chip => {
      totalBonus += parseInt(chip.dataset.bonus, 10) || 0;
    });

    const formatted = `+$${totalBonus}/yr estimated gain`;
    bonusUnlockedEl.textContent = formatted;
    summaryBonus.textContent = `+$${totalBonus}/yr`;
  }

  if (cardPillGroup) {
    cardPillGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.card-chip');
      if (!chip) return;

      chip.classList.toggle('active');
      updateEstimatedRewards();
    });
  }

  // ==========================================================================
  // 4. Tab Mode Switcher (Sign Up vs. Log In)
  // ==========================================================================
  function setAuthMode(mode) {
    currentMode = mode;
    clearErrors();

    if (mode === 'signup') {
      tabSignup.classList.add('active');
      tabSignup.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');

      authHeading.textContent = 'Get started with SwipeWise';
      authSubheading.textContent = 'Set up your smart wallet in 60 seconds. Free forever for up to 10 cards.';
      groupFullName.classList.remove('hidden');
      groupCheckboxes.classList.remove('hidden');
      strengthMeter.classList.remove('hidden');
      forgotPasswordLink.classList.add('hidden');
      btnSubmitText.textContent = 'Create Free Account';
      document.querySelector('.divider span').textContent = 'or sign up with email';
    } else {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabSignup.classList.remove('active');
      tabSignup.setAttribute('aria-selected', 'false');

      authHeading.textContent = 'Welcome back to SwipeWise';
      authSubheading.textContent = 'Sign in to access your card rewards, perks tracker, and statements.';
      groupFullName.classList.add('hidden');
      groupCheckboxes.classList.add('hidden');
      strengthMeter.classList.add('hidden');
      forgotPasswordLink.classList.remove('hidden');
      btnSubmitText.textContent = 'Log In to Wallet';
      document.querySelector('.divider span').textContent = 'or log in with email';
    }
  }

  tabSignup.addEventListener('click', () => setAuthMode('signup'));
  tabLogin.addEventListener('click', () => setAuthMode('login'));

  // ==========================================================================
  // 5. Password Visibility Toggle
  // ==========================================================================
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = inputPassword.getAttribute('type') === 'password';
    inputPassword.setAttribute('type', isPassword ? 'text' : 'password');
    eyeOpen.classList.toggle('hidden', isPassword);
    eyeClosed.classList.toggle('hidden', !isPassword);
  });

  // ==========================================================================
  // 6. Real-time Password Strength Meter & Requirement Tracker
  // ==========================================================================
  function evaluatePasswordStrength(password) {
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    reqLength.classList.toggle('met', hasLength);
    reqUpper.classList.toggle('met', hasUpper);
    reqNumber.classList.toggle('met', hasNumber);
    reqSpecial.classList.toggle('met', hasSpecial);

    let score = 0;
    if (hasLength) score++;
    if (hasUpper) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;

    strengthBars.className = 'strength-bars';
    if (password.length > 0) {
      strengthBars.classList.add(`score-${score}`);
    }

    const statuses = ['Too short', 'Weak', 'Fair', 'Strong', 'Unbreakable 🛡️'];
    strengthStatus.textContent = password.length === 0 ? 'Too short' : statuses[score];

    return { score, hasLength, hasUpper, hasNumber, hasSpecial };
  }

  inputPassword.addEventListener('input', () => {
    if (currentMode === 'signup') {
      evaluatePasswordStrength(inputPassword.value);
    }
    if (passwordError.textContent) {
      passwordError.textContent = '';
      inputPassword.classList.remove('invalid');
    }
  });

  inputName.addEventListener('input', () => {
    if (nameError.textContent) {
      nameError.textContent = '';
      inputName.classList.remove('invalid');
    }
  });

  inputEmail.addEventListener('input', () => {
    if (emailError.textContent) {
      emailError.textContent = '';
      inputEmail.classList.remove('invalid');
    }
  });

  // ==========================================================================
  // 7. Validation & Submission
  // ==========================================================================
  function clearErrors() {
    nameError.textContent = '';
    emailError.textContent = '';
    passwordError.textContent = '';
    termsError.textContent = '';
    [inputName, inputEmail, inputPassword].forEach(el => {
      el.classList.remove('invalid', 'valid');
    });
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();

    let isValid = true;
    const emailVal = inputEmail.value.trim();
    const passVal = inputPassword.value;

    if (currentMode === 'signup') {
      const nameVal = inputName.value.trim();
      if (!nameVal) {
        nameError.textContent = 'Please enter your name so we can personalize your cards.';
        inputName.classList.add('invalid');
        isValid = false;
      } else {
        inputName.classList.add('valid');
      }

      const strength = evaluatePasswordStrength(passVal);
      if (strength.score < 2 || !strength.hasLength) {
        passwordError.textContent = 'Please choose a stronger password (at least 8 chars + uppercase or number).';
        inputPassword.classList.add('invalid');
        isValid = false;
      } else {
        inputPassword.classList.add('valid');
      }

      if (!chkTerms.checked) {
        termsError.textContent = 'You must agree to the Terms of Service to continue.';
        isValid = false;
      }
    } else {
      if (!passVal) {
        passwordError.textContent = 'Please enter your password.';
        inputPassword.classList.add('invalid');
        isValid = false;
      }
    }

    if (!emailVal || !validateEmail(emailVal)) {
      emailError.textContent = 'Please enter a valid email address.';
      inputEmail.classList.add('invalid');
      isValid = false;
    } else {
      inputEmail.classList.add('valid');
    }

    if (!isValid) return;

    // Simulate async submission
    btnSubmit.disabled = true;
    btnSubmitText.textContent = currentMode === 'signup' ? 'Setting up wallet...' : 'Authenticating...';
    submitSpinner.classList.remove('hidden');

    setTimeout(() => {
      btnSubmit.disabled = false;
      submitSpinner.classList.add('hidden');
      btnSubmitText.textContent = currentMode === 'signup' ? 'Create Free Account' : 'Log In to Wallet';

      if (currentMode === 'signup') {
        summaryEmail.textContent = emailVal;
        successModal.classList.remove('hidden');
      } else {
        alert(`Welcome back, ${emailVal}! Redirecting to your SwipeWise dashboard.`);
      }
    }, 700);
  });

  // ==========================================================================
  // 8. Social Auth Integrations (Demo handlers)
  // ==========================================================================
  function handleSocialLogin(provider) {
    btnSubmitText.textContent = `Connecting to ${provider}...`;
    setTimeout(() => {
      btnSubmitText.textContent = currentMode === 'signup' ? 'Create Free Account' : 'Log In to Wallet';
      summaryEmail.textContent = `alex.demo@${provider.toLowerCase()}.com`;
      previewCardholder.textContent = 'ALEX MORGAN';
      inputName.value = 'Alex Morgan';
      inputEmail.value = `alex.demo@${provider.toLowerCase()}.com`;
      successModal.classList.remove('hidden');
    }, 600);
  }

  btnGoogle.addEventListener('click', () => handleSocialLogin('Google'));
  btnApple.addEventListener('click', () => handleSocialLogin('Apple'));

  // ==========================================================================
  // 9. Success Modal Actions
  // ==========================================================================
  btnDashboard.addEventListener('click', () => {
    alert('Navigating to SwipeWise Smart Card Wallet Dashboard! 🚀');
  });

  btnResetModal.addEventListener('click', () => {
    successModal.classList.add('hidden');
    form.reset();
    previewCardholder.textContent = 'YOUR NAME';
    strengthBars.className = 'strength-bars';
    strengthStatus.textContent = 'Too short';
    [reqLength, reqUpper, reqNumber, reqSpecial].forEach(el => el.classList.remove('met'));
    clearErrors();
  });
});
