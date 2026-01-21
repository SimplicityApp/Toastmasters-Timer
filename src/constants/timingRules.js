// Default timing rules for different speech types (in seconds)
export const DEFAULT_ROLE_RULES = {
  'Standard Speech': { green: 300, yellow: 360, red: 420 }, // 5-6-7 min
  'Ice Breaker': { green: 240, yellow: 300, red: 360 }, // 4-5-6 min
  'Table Topics': { green: 60, yellow: 90, red: 120 }, // 1-1.5-2 min
  'Evaluation': { green: 120, yellow: 150, red: 180 }, // 2-2.5-3 min
  'Toast': { green: 60, yellow: 90, red: 120 }, // 1-1.5-2 min
  'Custom': { green: 300, yellow: 360, red: 420 }, // Default to Standard Speech
};

export const ROLE_OPTIONS = Object.keys(DEFAULT_ROLE_RULES);

// Helper to detect role from text
export function detectRoleFromText(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('ice breaker') || lowerText.includes('icebreaker')) {
    return 'Ice Breaker';
  }
  if (lowerText.includes('table topic')) {
    return 'Table Topics';
  }
  if (lowerText.includes('evaluation') || lowerText.includes('evaluator')) {
    return 'Evaluation';
  }
  if (lowerText.includes('toast')) {
    return 'Toast';
  }
  return 'Standard Speech';
}
