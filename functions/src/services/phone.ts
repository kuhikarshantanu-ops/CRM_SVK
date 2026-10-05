export interface NormalizedPhone {
  raw: string;
  e164: string;           // "+919371872013"
  countryCode: string;    // "91"
  nationalNumber: string; // "9371872013"
  isValid: boolean;
}

export function normalizePhoneNumber(
  input: string,
  defaultCountryCode = '91'
): NormalizedPhone {
  if (!input || typeof input !== 'string') {
    return {
      raw: '',
      e164: '',
      countryCode: defaultCountryCode,
      nationalNumber: '',
      isValid: false
    };
  }

  const raw = input.trim();
  let digits = raw.replace(/[^\d+]/g, '');
  let countryCode = defaultCountryCode;
  let nationalNumber = '';

  if (digits.startsWith('+')) {
    digits = digits.substring(1);
    if (digits.startsWith('91') && digits.length === 12) {
      countryCode = '91';
      nationalNumber = digits.substring(2);
    } else if (digits.length > 10) {
      nationalNumber = digits.slice(-10);
      countryCode = digits.slice(0, -10);
    } else {
      nationalNumber = digits;
    }
  } else if (digits.startsWith('0') && digits.length === 11) {
    countryCode = defaultCountryCode;
    nationalNumber = digits.substring(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    countryCode = '91';
    nationalNumber = digits.substring(2);
  } else if (digits.length === 10) {
    countryCode = defaultCountryCode;
    nationalNumber = digits;
  } else {
    nationalNumber = digits;
  }

  const isValid = /^\d{10,14}$/.test(nationalNumber);
  const e164 = isValid ? `+${countryCode}${nationalNumber}` : '';

  return { raw, e164, countryCode, nationalNumber, isValid };
}

export function buildDeterministicConversationId(
  workspaceId: string,
  phone: NormalizedPhone
): string {
  if (!phone.isValid) {
    throw new Error(`Invalid phone number for conversation ID: ${phone.raw}`);
  }
  return `conv_${workspaceId}_${phone.countryCode}_${phone.nationalNumber}`;
}
