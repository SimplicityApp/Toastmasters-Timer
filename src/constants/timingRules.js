// Default timing rules for different speech types (in seconds)
export const DEFAULT_ROLE_RULES = {
  'Short Roles': { green: 60, yellow: 90, red: 120 }, // 1-1.5-2 min
  'Table Topics Speech': { green: 60, yellow: 90, red: 120 }, // 1-1.5-2 min
  'Table Topics Evaluation': { green: 30, yellow: 45, red: 60 }, // 30-45-60 sec
  'Standard Speech': { green: 300, yellow: 360, red: 420 }, // 5-6-7 min
  'Ice Breaker': { green: 240, yellow: 300, red: 360 }, // 4-5-6 min
  'Speech Evaluation': { green: 120, yellow: 150, red: 180 }, // 2-2.5-3 min
  'Custom': { green: 300, yellow: 360, red: 420 }, // Default to Standard Speech
};

export const ROLE_OPTIONS = Object.keys(DEFAULT_ROLE_RULES);

// Helper to detect role from text
export function detectRoleFromText(text) {
  const normalized = text.toLowerCase().trim();
  
  // First, try exact case-insensitive match against role names (excluding 'Custom')
  if (normalized === 'standard speech') return 'Standard Speech';
  if (normalized === 'ice breaker') return 'Ice Breaker';
  if (normalized === 'table topics') return 'Table Topics';
  if (normalized === 'table topics evaluation') return 'Table Topics Evaluation';
  if (normalized === 'speech evaluation') return 'Speech Evaluation';
  if (normalized === 'short roles') return 'Short Roles';
  
  // Then check for partial matches in order of specificity (most specific first)
  // Most specific: "Table Topics Evaluation" (must check before "Table Topics")
  if (normalized.includes('table topics evaluation')) {
    return 'Table Topics Evaluation';
  }
  
  // "Speech Evaluation" (must check before generic "Evaluation")
  if (normalized.includes('speech evaluation')) {
    return 'Speech Evaluation';
  }
  
  // "Ice Breaker" or "Icebreaker"
  if (normalized.includes('ice breaker') || normalized.includes('icebreaker')) {
    return 'Ice Breaker';
  }
  
  // "Table Topics" (after checking for "Table Topics Evaluation")
  if (normalized.includes('table topics')) {
    return 'Table Topics';
  }
  
  // "Short Roles"
  if (normalized.includes('short roles') || normalized.includes('short role')) {
    return 'Short Roles';
  }
  
  // Generic "Evaluation" or "Evaluator" (only if not already matched)
  if (normalized.includes('evaluation') || normalized.includes('evaluator')) {
    return 'Speech Evaluation';
  }
  
  // Default fallback
  return 'Standard Speech';
}
