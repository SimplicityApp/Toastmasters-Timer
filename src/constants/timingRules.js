// Default timing rules for different speech types (in seconds)
export const DEFAULT_ROLE_RULES = {
  'Short Roles': { green: 60, yellow: 90, red: 120 }, // 1-1.5-2 min
  'Table Topics Speech': { green: 60, yellow: 90, red: 120 }, // 1-1.5-2 min
  'Table Topics Evaluation': { green: 30, yellow: 45, red: 60 }, // 30-45-60 sec
  'Standard Speech': { green: 300, yellow: 360, red: 420 }, // 5-6-7 min
  'Ice Breaker': { green: 240, yellow: 300, red: 360 }, // 4-5-6 min
  'Speech Evaluation': { green: 120, yellow: 150, red: 180 }, // 2-2.5-3 min
  'General Evaluation': { green: 180, yellow: 240, red: 300 }, // 3-4-5 min
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
  if (normalized === 'general evaluation') return 'General Evaluation';
  if (normalized === 'short roles') return 'Short Roles';
  
  // Then check for partial matches in order of specificity (most specific first)
  // Most specific: "Table Topics Evaluation" (must check before "Table Topics")
  if (normalized.includes('table topics evaluation')) {
    return 'Table Topics Evaluation';
  }
  
  // "General Evaluation" or "General Evaluator" (must check before "Speech Evaluation")
  if (normalized.includes('general evaluation') || normalized.includes('general evaluator')) {
    return 'General Evaluation';
  }
  
  // "Speech Evaluation" (must check before generic "Evaluation")
  if (normalized.includes('speech evaluation')) {
    return 'Speech Evaluation';
  }
  
  // "Ice Breaker" or "Icebreaker" - also check for project descriptions
  if (normalized.includes('ice breaker') || 
      normalized.includes('icebreaker') ||
      normalized.includes('ice breaker #') ||
      normalized.includes('icebreaker #')) {
    return 'Ice Breaker';
  }
  
  // "Table Topics" (after checking for "Table Topics Evaluation")
  if (normalized.includes('table topics')) {
    return 'Table Topics';
  }
  
  // EasySpeak-style speaker roles (1st Speaker, 2nd Speaker, etc.)
  // Check if it contains "speaker" and potentially project info
  if (normalized.match(/\d+(st|nd|rd|th)\s+speaker/) || 
      (normalized.includes('speaker') && !normalized.includes('evaluator'))) {
    // Check for Ice Breaker indicators in the text
    if (normalized.includes('ice breaker') || normalized.includes('icebreaker')) {
      return 'Ice Breaker';
    }
    // Default speakers to Standard Speech
    return 'Standard Speech';
  }
  
  // EasySpeak-style evaluator roles
  // Check for "General Evaluator" first (before numbered evaluators)
  if (normalized.includes('general evaluator')) {
    return 'General Evaluation';
  }
  
  // Numbered evaluators (1st Evaluator, 2nd Evaluator, etc.)
  if (normalized.match(/\d+(st|nd|rd|th)\s+evaluator/) ||
      (normalized.includes('evaluator') && !normalized.includes('table topics') && !normalized.includes('general'))) {
    return 'Speech Evaluation';
  }
  
  // EasySpeak short roles
  if (normalized.includes('timer') ||
      normalized.includes('grammarian') ||
      normalized.includes('toast') ||
      normalized.includes('moment of humour') ||
      normalized.includes('public speaking tip') ||
      normalized.includes('moment of reflection') ||
      normalized.includes('table topics master') ||
      normalized.includes('chairperson') ||
      normalized.includes('toastmaster') ||
      normalized.includes('sergeant at arms') ||
      normalized.includes('ah counter')) {
    return 'Short Roles';
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
