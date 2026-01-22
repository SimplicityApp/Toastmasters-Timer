import { DEFAULT_ROLE_RULES } from '../constants/timingRules';

/**
 * Maps EasySpeak role names to app role names
 */
function mapEasySpeakRoleToAppRole(easySpeakRole, speechDetails = null) {
  const normalized = easySpeakRole.toLowerCase().trim();
  
  // Speaker roles - check speech details for Ice Breaker
  if (normalized.includes('speaker')) {
    if (speechDetails) {
      const detailsLower = speechDetails.toLowerCase();
      if (detailsLower.includes('icebreaker') || detailsLower.includes('ice breaker')) {
        return 'Ice Breaker';
      }
    }
    return 'Standard Speech';
  }
  
  // Evaluator roles
  if (normalized.includes('evaluator')) {
    return 'Speech Evaluation';
  }
  
  // Short roles - various meeting roles
  const shortRoles = [
    'timer',
    'grammarian',
    'toast',
    'moment of humour',
    'moment of reflection',
    'table topics master',
    'chairperson',
    'toastmaster',
    'sergeant at arms',
    'ah counter',
    'general evaluator', // This is also a short role, but we map it to Speech Evaluation above
  ];
  
  for (const shortRole of shortRoles) {
    if (normalized.includes(shortRole)) {
      // General Evaluator is already handled above, so skip it here
      if (shortRole === 'general evaluator') continue;
      return 'Short Roles';
    }
  }
  
  // Default fallback
  return 'Standard Speech';
}

/**
 * Detects if the text is in EasySpeak format
 */
export function isEasySpeakFormat(text) {
  const lines = text.split('\n');
  const textLower = text.toLowerCase();
  
  // Check for EasySpeak indicators
  return (
    textLower.includes('actual meeting roles') ||
    textLower.includes('role\tcl\tpresenter') ||
    /^\d+(st|nd|rd|th)\s+speaker/i.test(text) ||
    /^\d+(st|nd|rd|th)\s+evaluator/i.test(text) ||
    textLower.includes('general evaluator') ||
    textLower.includes('table topics master')
  );
}

/**
 * Checks if a line contains both role and name separated by tab or multiple spaces
 * Returns { role, name } if found, null otherwise
 */
function parseTabSeparatedRoleName(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Check for tab-separated: "Role\tName" or "Role\t\tName"
  const tabMatch = trimmed.match(/^(.+?)\t+(.+)$/);
  if (tabMatch) {
    const potentialRole = tabMatch[1].trim();
    const potentialName = tabMatch[2].trim();
    
    // Check if first part looks like a role
    const rolePatterns = [
      /^\d+(st|nd|rd|th)\s+speaker/i,
      /^\d+(st|nd|rd|th)\s+evaluator/i,
      /moment\s+of\s+(humour|reflection)/i,
      /timer|grammarian|toast|table\s+topics\s+master|chairperson|toastmaster|sergeant\s+at\s+arms|general\s+evaluator/i
    ];
    
    const looksLikeRole = rolePatterns.some(pattern => pattern.test(potentialRole));
    
    // Check if second part looks like a name (not too long, doesn't contain role indicators)
    const looksLikeName = potentialName.length < 100 &&
                          !potentialName.match(/\(.*#\d+.*\)/i) &&
                          !potentialName.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) &&
                          !potentialName.toLowerCase().includes('effective coaching') &&
                          !potentialName.toLowerCase().includes('dynamic leadership');
    
    if (looksLikeRole && looksLikeName) {
      return { role: potentialRole, name: potentialName };
    }
  }
  
  // Check for space-separated (2+ spaces): "Role    Name"
  const spaceMatch = trimmed.match(/^(.+?)\s{2,}(.+)$/);
  if (spaceMatch) {
    const potentialRole = spaceMatch[1].trim();
    const potentialName = spaceMatch[2].trim();
    
    // Check if first part looks like a role
    const rolePatterns = [
      /^\d+(st|nd|rd|th)\s+speaker/i,
      /^\d+(st|nd|rd|th)\s+evaluator/i,
      /moment\s+of\s+(humour|reflection)/i,
      /timer|grammarian|toast|table\s+topics\s+master|chairperson|toastmaster|sergeant\s+at\s+arms|general\s+evaluator/i
    ];
    
    const looksLikeRole = rolePatterns.some(pattern => pattern.test(potentialRole));
    
    // Check if second part looks like a name
    const looksLikeName = potentialName.length < 100 &&
                          !potentialName.match(/\(.*#\d+.*\)/i) &&
                          !potentialName.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) &&
                          !potentialName.toLowerCase().includes('effective coaching') &&
                          !potentialName.toLowerCase().includes('dynamic leadership');
    
    if (looksLikeRole && looksLikeName) {
      return { role: potentialRole, name: potentialName };
    }
  }
  
  return null;
}

/**
 * Parses EasySpeak meeting details format
 * Supports both "show speech details" and "hide speech details" modes
 */
export function parseEasySpeakText(text) {
  const lines = text.split('\n');
  const items = [];
  let currentRole = null;
  let currentName = null;
  let speechDetails = null;
  let collectingSpeechDetails = false;
  let showSpeechDetailsMode = false;
  let skipPreviousEvaluators = false;
  
  // Detect if we're in "show speech details" mode
  // This mode has speech titles and project info after speaker names
  const textLower = text.toLowerCase();
  showSpeechDetailsMode = textLower.includes('effective coaching') || 
                         textLower.includes('dynamic leadership') ||
                         textLower.includes('pathways') ||
                         /\(\d+:\d+-\d+:\d+\s+min\)/.test(text);
  
  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const line = originalLine.trim();
    const isIndented = originalLine.match(/^[\s\t]+/);
    
    // Skip empty lines
    if (!line) {
      // If we were collecting speech details, finalize the current item
      if (currentName && currentRole && collectingSpeechDetails) {
        items.push({
          name: currentName,
          role: mapEasySpeakRoleToAppRole(currentRole, speechDetails),
          speechDetails: showSpeechDetailsMode ? speechDetails : null
        });
        currentName = null;
        currentRole = null;
        speechDetails = null;
        collectingSpeechDetails = false;
      }
      skipPreviousEvaluators = false;
      continue;
    }
    
    // Skip header lines
    if (line.toLowerCase().includes('actual meeting roles') ||
        line.toLowerCase().includes('role\tcl\tpresenter') ||
        line === 'Role' ||
        line === 'CL' ||
        line === 'Presenter' ||
        line.match(/^role\s+cl\s+presenter$/i)) {
      continue;
    }
    
    // First, check if this line contains both role and name (tab or space-separated)
    const tabSeparated = parseTabSeparatedRoleName(originalLine);
    if (tabSeparated) {
      // Finalize previous item if exists
      if (currentName && currentRole) {
        items.push({
          name: currentName,
          role: mapEasySpeakRoleToAppRole(currentRole, speechDetails),
          speechDetails: showSpeechDetailsMode ? speechDetails : null
        });
      }
      
      // Process the tab-separated role and name
      currentRole = tabSeparated.role;
      currentName = tabSeparated.name;
      speechDetails = null;
      collectingSpeechDetails = false;
      skipPreviousEvaluators = false;
      
      // Check if next line starts speech details (in show speech details mode)
      if (showSpeechDetailsMode && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const looksLikeSpeechDetails = nextLine &&
                                       !nextLine.match(/^\d+(st|nd|rd|th)\s+/i) &&
                                       !nextLine.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) &&
                                       (nextLine.match(/\(.*#\d+.*\)/i) ||
                                        nextLine.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) ||
                                        nextLine.toLowerCase().includes('effective coaching') ||
                                        nextLine.toLowerCase().includes('dynamic leadership') ||
                                        nextLine.toLowerCase().includes('pathways') ||
                                        nextLine.length > 20);
        
        if (looksLikeSpeechDetails) {
          collectingSpeechDetails = true;
          speechDetails = nextLine;
          i++; // Skip next line since we're processing it
        }
      }
      continue;
    }
    
    // Check if this line is a role header
    // Allow role detection even on indented lines (from table copies)
    const trimmedLine = line.trim();
    const isRoleHeader = (
      /^\d+(st|nd|rd|th)\s+speaker/i.test(trimmedLine) ||
      /^\d+(st|nd|rd|th)\s+evaluator/i.test(trimmedLine) ||
      trimmedLine.toLowerCase().includes('general evaluator') ||
      trimmedLine.toLowerCase().includes('timer') ||
      trimmedLine.toLowerCase().includes('grammarian') ||
      trimmedLine.toLowerCase().includes('toast') ||
      (trimmedLine.toLowerCase().includes('moment') && (trimmedLine.toLowerCase().includes('humour') || trimmedLine.toLowerCase().includes('reflection'))) ||
      trimmedLine.toLowerCase().includes('table topics master') ||
      trimmedLine.toLowerCase().includes('chairperson') ||
      trimmedLine.toLowerCase().includes('toastmaster') ||
      (trimmedLine.toLowerCase().includes('sergeant') && trimmedLine.toLowerCase().includes('arms'))
    );
    
    if (isRoleHeader) {
      // Finalize previous item if exists
      if (currentName && currentRole) {
        items.push({
          name: currentName,
          role: mapEasySpeakRoleToAppRole(currentRole, speechDetails),
          speechDetails: showSpeechDetailsMode ? speechDetails : null
        });
      }
      
      // Start new role (use trimmed line to remove indentation)
      currentRole = trimmedLine;
      currentName = null;
      speechDetails = null;
      collectingSpeechDetails = false;
      skipPreviousEvaluators = false;
      
      // Check if next line contains a name (even if not indented)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.match(/^\d+(st|nd|rd|th)\s+/i)) {
          // Check if next line looks like a name
          const looksLikeName = nextLine.length < 100 &&
                                !nextLine.match(/^\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) &&
                                !nextLine.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) &&
                                !nextLine.match(/\(.*#\d+.*\)/i) &&
                                !nextLine.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) &&
                                !nextLine.toLowerCase().includes('deliver a speech') &&
                                !nextLine.toLowerCase().includes('present either') &&
                                !nextLine.toLowerCase().includes('effective coaching') &&
                                !nextLine.toLowerCase().includes('dynamic leadership') &&
                                !nextLine.toLowerCase().includes('pathways') &&
                                !nextLine.toLowerCase().includes('previous evaluators');
          
          if (looksLikeName) {
            currentName = nextLine;
            i++; // Skip next line since we're processing it
            continue;
          }
        }
      }
      
      continue;
    }
    
    // Skip "Previous Evaluators" section
    if (line.toLowerCase().includes('previous evaluators')) {
      skipPreviousEvaluators = true;
      continue;
    }
    
    // Skip lines in "Previous Evaluators" section (username + date format)
    if (skipPreviousEvaluators) {
      if (line.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
          line.match(/^\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) {
        continue;
      } else {
        // End of previous evaluators section
        skipPreviousEvaluators = false;
      }
    }
    
    // If we're collecting speech details, continue collecting
    // Note: Role headers are handled earlier, so if we hit one, currentName will be null
    if (collectingSpeechDetails && currentName && currentRole) {
      // Stop collecting if we hit what looks like a new name (indented line that looks like a name)
      // This handles the case where multiple speakers have the same role
      if (isIndented && line.length < 100 && 
          !line.match(/\(.*#\d+.*\)/i) &&
          !line.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) &&
          !line.toLowerCase().includes('effective coaching') &&
          !line.toLowerCase().includes('dynamic leadership') &&
          !line.toLowerCase().includes('pathways') &&
          !line.toLowerCase().includes('deliver') &&
          !line.toLowerCase().includes('present') &&
          !line.match(/^\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) &&
          !line.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) {
        // This might be a new name, finalize current item
        items.push({
          name: currentName,
          role: mapEasySpeakRoleToAppRole(currentRole, speechDetails),
          speechDetails: showSpeechDetailsMode ? speechDetails : null
        });
        currentName = null;
        currentRole = null;
        speechDetails = null;
        collectingSpeechDetails = false;
        // Continue to process this line as potential name (will be handled in name check below)
        continue;
      }
      
      // Continue collecting speech details
      if (line && 
          !line.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) { // Not username + date
        speechDetails = (speechDetails ? speechDetails + ' ' : '') + line;
      }
      continue;
    }
    
    // Check if this line contains a name
    // Allow both indented and non-indented lines when we have a currentRole
    // This handles cases where table copy splits role and name into separate lines
    if (currentRole && !currentName && !skipPreviousEvaluators) {
      const name = line.trim();
      
      // Check if it looks like a name (not a date, not a project path, not instructions, not a role)
      const isName = name &&
                     !name.match(/^\d+(st|nd|rd|th)\s+/i) && // Not a role header
                     !name.match(/^\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) && // Not a date
                     !name.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) && // Not username + date
                     !name.match(/\(.*#\d+.*\)/i) && // Not project path
                     !name.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) && // Not time range
                     !name.toLowerCase().includes('deliver a speech') &&
                     !name.toLowerCase().includes('present either') &&
                     !name.toLowerCase().includes('effective coaching') &&
                     !name.toLowerCase().includes('dynamic leadership') &&
                     !name.toLowerCase().includes('pathways') &&
                     !name.toLowerCase().includes('previous evaluators') &&
                     name.length < 100 && // Reasonable name length
                     name.length > 0; // Not empty
      
      if (isName) {
        currentName = name;
        collectingSpeechDetails = false;
        speechDetails = null;
        continue; // Process name, next iteration will check for speech details
      }
    }
    
    // Check if current line is speech details (after a name, in show speech details mode)
    // Speech details can be indented or not, but should follow a name
    if (currentName && currentRole && !collectingSpeechDetails && showSpeechDetailsMode) {
      const looksLikeSpeechDetails = line &&
                                     !line.match(/^\d+(st|nd|rd|th)\s+/i) && // Not a role header
                                     !line.match(/^[a-z0-9]+\s+\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) && // Not username + date
                                     !isRoleHeader && // Not a role header
                                     (line.match(/\(.*#\d+.*\)/i) || // Contains project path
                                      line.match(/\(\d+:\d+-\d+:\d+\s+min\)/i) || // Contains time range
                                      line.toLowerCase().includes('effective coaching') ||
                                      line.toLowerCase().includes('dynamic leadership') ||
                                      line.toLowerCase().includes('pathways') ||
                                      (line.length > 15 && // Reasonable length for speech title
                                       !line.toLowerCase().includes('deliver a speech') &&
                                       !line.toLowerCase().includes('present either') &&
                                       !line.toLowerCase().includes('previous evaluators')));
      
      if (looksLikeSpeechDetails) {
        collectingSpeechDetails = true;
        speechDetails = line;
        continue;
      }
    }
  }
  
  // Finalize last item if exists
  if (currentName && currentRole) {
    items.push({
      name: currentName,
      role: mapEasySpeakRoleToAppRole(currentRole, speechDetails),
      speechDetails: showSpeechDetailsMode ? speechDetails : null
    });
  }
  
  return items;
}
