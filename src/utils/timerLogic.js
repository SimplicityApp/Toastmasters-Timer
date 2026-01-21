/**
 * Calculate the current status color based on elapsed time and rules
 * @param {number} elapsedSeconds - Elapsed time in seconds
 * @param {Object} rules - Timing rules with green, yellow, red thresholds
 * @returns {'white' | 'green' | 'yellow' | 'red'} Current status color
 */
export function calculateStatus(elapsedSeconds, rules) {
  if (!rules || typeof rules.green !== 'number') {
    return 'white';
  }

  if (elapsedSeconds < rules.green) {
    return 'white';
  } else if (elapsedSeconds < rules.yellow) {
    return 'green';
  } else if (elapsedSeconds < rules.red) {
    return 'yellow';
  } else {
    return 'red';
  }
}

/**
 * Format seconds as MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (MM:SS)
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculate the end time for the current phase
 * @param {number} elapsedSeconds - Current elapsed time
 * @param {Object} rules - Timing rules
 * @param {'white' | 'green' | 'yellow' | 'red'} currentStatus - Current status
 * @returns {Object} { phase: string, endsAt: number } or null if in red phase
 */
export function getPhaseInfo(elapsedSeconds, rules, currentStatus) {
  if (!rules) return null;

  if (currentStatus === 'white') {
    return {
      phase: 'White phase',
      endsAt: rules.green,
      nextPhase: 'Green'
    };
  } else if (currentStatus === 'green') {
    return {
      phase: 'Green phase',
      endsAt: rules.yellow,
      nextPhase: 'Yellow'
    };
  } else if (currentStatus === 'yellow') {
    return {
      phase: 'Yellow phase',
      endsAt: rules.red,
      nextPhase: 'Red'
    };
  } else {
    // Red phase - no end time
    return {
      phase: 'Red phase',
      endsAt: null,
      nextPhase: null
    };
  }
}

/**
 * Format phase info as display string
 * @param {Object} phaseInfo - Phase info from getPhaseInfo
 * @returns {string} Formatted phase string
 */
export function formatPhaseText(phaseInfo) {
  if (!phaseInfo) return '';
  
  if (phaseInfo.endsAt !== null) {
    const endTime = formatTime(phaseInfo.endsAt);
    return `${phaseInfo.phase} (ends at ${endTime})`;
  } else {
    return phaseInfo.phase;
  }
}
