export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function trimFormValues(values) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ])
  );
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

export function isValidPhone(value) {
  const phone = String(value || '').trim();
  const digits = phone.replace(/\D/g, '');
  return /^[+\d][\d\s().-]*$/.test(phone) && digits.length >= 7 && digits.length <= 15;
}

export function firstApiError(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;

  for (const [field, messages] of Object.entries(data)) {
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (typeof message === 'string') {
      const label = field.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
      return `${label}: ${message}`;
    }
  }
  return fallback;
}

export function validateEnquiry(values, { requirePhone = false, requireCountry = false } = {}) {
  const cleaned = trimFormValues(values);
  if (!cleaned.name) return { cleaned, error: 'Please enter your name.' };
  if (cleaned.name.length < 2) return { cleaned, error: 'Please enter at least 2 characters for your name.' };
  if (!cleaned.email) return { cleaned, error: 'Please enter your email address.' };
  if (!isValidEmail(cleaned.email)) return { cleaned, error: 'Please enter a valid email address.' };
  if (requirePhone && !cleaned.phone) return { cleaned, error: 'Please enter a phone number.' };
  if (cleaned.phone && !isValidPhone(cleaned.phone)) {
    return { cleaned, error: 'Please enter a valid phone number with 7 to 15 digits.' };
  }
  if (requireCountry && !cleaned.country) return { cleaned, error: 'Please enter your country.' };
  if (!cleaned.message) return { cleaned, error: 'Please enter a message.' };
  if (cleaned.message.length < 10) return { cleaned, error: 'Please enter at least 10 characters in your message.' };
  cleaned.email = cleaned.email.toLowerCase();
  return { cleaned, error: '' };
}

export function validateCheckout(values) {
  const cleaned = trimFormValues(values);
  const required = [
    ['email', 'email address'],
    ['name', 'full name'],
    ['phone', 'phone number'],
    ['address', 'street address'],
    ['city', 'city'],
    ['state', 'state or region'],
    ['zip', 'postal code'],
  ];
  const missing = required.find(([key]) => !cleaned[key]);
  if (missing) return { cleaned, error: `Please enter your ${missing[1]}.` };
  if (!isValidEmail(cleaned.email)) return { cleaned, error: 'Please enter a valid email address.' };
  if (!isValidPhone(cleaned.phone)) {
    return { cleaned, error: 'Please enter a valid phone number with 7 to 15 digits.' };
  }
  if (cleaned.name.length < 2) return { cleaned, error: 'Please enter your full name.' };
  if (cleaned.address.length < 5) return { cleaned, error: 'Please enter a complete street address.' };
  if (cleaned.city.length < 2 || cleaned.state.length < 2) {
    return { cleaned, error: 'Please enter a valid city and state or region.' };
  }
  if (cleaned.zip.length < 3 || cleaned.zip.length > 12) {
    return { cleaned, error: 'Please enter a valid postal code.' };
  }
  cleaned.email = cleaned.email.toLowerCase();
  return { cleaned, error: '' };
}
