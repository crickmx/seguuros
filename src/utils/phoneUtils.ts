export function normalizePhoneNumber(phone: string): { e164: string; plain: string } {
  if (!phone || phone.trim() === '') {
    return { e164: '', plain: '' };
  }

  const cleaned = phone.replace(/[^0-9+]/g, '');

  let e164: string;

  if (/^\+521[0-9]{10}$/.test(cleaned)) {
    e164 = cleaned;
  } else if (/^\+52[0-9]{10}$/.test(cleaned)) {
    e164 = '+521' + cleaned.substring(3);
  } else if (/^521[0-9]{10}$/.test(cleaned)) {
    e164 = '+' + cleaned;
  } else if (/^52[0-9]{10}$/.test(cleaned)) {
    e164 = '+521' + cleaned.substring(2);
  } else if (/^[0-9]{10}$/.test(cleaned)) {
    e164 = '+521' + cleaned;
  } else {
    e164 = phone;
  }

  const plain = e164.replace('+', '');

  return { e164, plain };
}

export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('521') && cleaned.length === 13) {
    const lada = cleaned.substring(3, 6);
    const first = cleaned.substring(6, 9);
    const second = cleaned.substring(9, 13);
    return `+52 1 ${lada} ${first} ${second}`;
  }

  if (cleaned.startsWith('52') && cleaned.length === 12) {
    const lada = cleaned.substring(2, 5);
    const first = cleaned.substring(5, 8);
    const second = cleaned.substring(8, 12);
    return `+52 ${lada} ${first} ${second}`;
  }

  return phone;
}
