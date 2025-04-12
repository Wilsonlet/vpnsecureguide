/**
 * Card Validator Utility
 * 
 * Implements Luhn algorithm for credit card validation
 * and provides card type detection based on card number patterns
 */

export interface CardType {
  name: string;
  pattern: RegExp;
  format: RegExp;
  length: number[];
  cvvLength: number[];
  luhn: boolean;
}

export const CARD_TYPES: CardType[] = [
  {
    name: 'Visa',
    pattern: /^4/,
    format: /(\d{1,4})/g,
    length: [13, 16, 19],
    cvvLength: [3],
    luhn: true
  },
  {
    name: 'Mastercard',
    pattern: /^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/,
    format: /(\d{1,4})/g,
    length: [16],
    cvvLength: [3],
    luhn: true
  },
  {
    name: 'American Express',
    pattern: /^3[47]/,
    format: /(\d{1,4})(\d{1,6})?(\d{1,5})?/,
    length: [15],
    cvvLength: [4],
    luhn: true
  },
  {
    name: 'Discover',
    pattern: /^(6011|65|64[4-9]|622)/,
    format: /(\d{1,4})/g,
    length: [16, 19],
    cvvLength: [3],
    luhn: true
  },
  {
    name: 'JCB',
    pattern: /^35/,
    format: /(\d{1,4})/g,
    length: [16, 19],
    cvvLength: [3],
    luhn: true
  },
  {
    name: 'UnionPay',
    pattern: /^62/,
    format: /(\d{1,4})/g,
    length: [16, 17, 18, 19],
    cvvLength: [3],
    luhn: false
  },
  {
    name: 'Maestro',
    pattern: /^(5018|5020|5038|6304|6703|6708|6759|676[1-3])/,
    format: /(\d{1,4})/g,
    length: [12, 13, 14, 15, 16, 17, 18, 19],
    cvvLength: [3],
    luhn: true
  },
  {
    name: 'Verve',
    pattern: /^(506099|5061|5062|506300|506310|506311|506999|507|650002|650004|650005|650006|650007|650008|650009|65001|65002|65003|650050|650051)/,
    format: /(\d{1,4})/g,
    length: [16, 17, 18, 19],
    cvvLength: [3],
    luhn: true
  }
];

/**
 * Validate a credit card number using the Luhn algorithm
 * 
 * @param value - The credit card number to validate
 * @returns Whether the card number is valid according to the Luhn algorithm
 */
export function validateLuhn(value: string): boolean {
  // Remove all non-digit characters
  const cardNumber = value.replace(/\D/g, '');
  
  let sum = 0;
  let shouldDouble = false;

  // Loop through values starting from the rightmost digit
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i));

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Identify the type of credit card based on its number
 * 
 * @param value - The credit card number
 * @returns The detected card type or undefined if not recognized
 */
export function getCardType(value: string): CardType | undefined {
  const cleanValue = value.replace(/\D/g, '');
  return CARD_TYPES.find(type => {
    return type.pattern.test(cleanValue);
  });
}

/**
 * Validate a credit card number
 * 
 * @param value - The credit card number to validate
 * @returns Validation result with card type and any error message
 */
export function validateCard(value: string): { 
  valid: boolean; 
  cardType?: CardType; 
  error?: string; 
} {
  // Remove all non-digit characters
  const cleanValue = value.replace(/\D/g, '');
  
  if (!cleanValue) {
    return { valid: false, error: 'Card number is required' };
  }
  
  const cardType = getCardType(cleanValue);
  
  if (!cardType) {
    return { valid: false, error: 'Card type not recognized', cardType: undefined };
  }
  
  if (cardType.length.indexOf(cleanValue.length) === -1) {
    return {
      valid: false,
      cardType,
      error: `${cardType.name} cards must be ${cardType.length.join(' or ')} digits`
    };
  }
  
  if (cardType.luhn && !validateLuhn(cleanValue)) {
    return { valid: false, cardType, error: 'Invalid card number' };
  }
  
  return { valid: true, cardType };
}

/**
 * Format a credit card number according to its type's format
 * 
 * @param value - The credit card number to format
 * @returns Formatted card number with appropriate spacing
 */
export function formatCardNumber(value: string): string {
  const cleanValue = value.replace(/\D/g, '');
  const cardType = getCardType(cleanValue);
  
  if (!cardType) {
    // Default formatting in groups of 4 digits
    return cleanValue.replace(/(.{4})/g, '$1 ').trim();
  }
  
  // Use the card type's format
  const matches = cleanValue.match(cardType.format);
  if (matches) {
    return matches.join(' ').trim();
  }
  
  return cleanValue;
}

/**
 * Format expiry date with slash
 * 
 * @param value - The expiry date value
 * @returns Formatted expiry date as MM/YY
 */
export function formatExpiryDate(value: string): string {
  // Remove any non-digits and slashes first
  const v = value.replace(/[^\d\/]/g, '');
  
  // If there's already a slash, handle differently
  if (v.includes('/')) {
    const [month, year] = v.split('/');
    // Return just the first 2 digits of month and year
    return `${month.substring(0, 2)}/${year.substring(0, 2)}`;
  }
  
  // No slash - format as MM/YY
  const digits = v.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  
  // Auto-format XX/ if user types a number > 1 for first digit
  if (digits.length === 2 && parseInt(digits.charAt(0), 10) > 1) {
    // If month might be invalid (>12), adjust to valid month
    const month = parseInt(digits.substring(0, 2), 10);
    if (month > 12) return `0${digits.charAt(0)}/${digits.charAt(1)}`;
  }
  
  return `${digits.substring(0, 2)}/${digits.substring(2, 4)}`;
}

/**
 * Validate an expiry date
 * 
 * @param month - Month value (1-12)
 * @param year - Year value (YY format)
 * @returns Whether the expiry date is valid and not expired
 */
export function validateExpiryDate(month: string, year: string): boolean {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
  const currentYear = currentDate.getFullYear() % 100; // Get last 2 digits
  
  const expMonth = parseInt(month, 10);
  const expYear = parseInt(year, 10);
  
  // Basic validation
  if (isNaN(expMonth) || isNaN(expYear) || expMonth < 1 || expMonth > 12) {
    return false;
  }
  
  // Check if card is expired
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return false;
  }
  
  return true;
}

/**
 * Validate a CVV number
 * 
 * @param cvv - The CVV to validate
 * @param cardType - The card type to validate against
 * @returns Whether the CVV is valid for the given card type
 */
export function validateCVV(cvv: string, cardType?: CardType): boolean {
  const cleanCvv = cvv.replace(/\D/g, '');
  
  if (!cardType) {
    // Default to requiring 3 digits
    return cleanCvv.length === 3;
  }
  
  return cardType.cvvLength.includes(cleanCvv.length);
}