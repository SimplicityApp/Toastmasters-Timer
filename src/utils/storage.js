const STORAGE_KEYS = {
  AGENDA: 'toastmaster_agenda',
  REPORTS: 'toastmaster_reports',
  ROLE_RULES: 'toastmaster_role_rules',
};

/**
 * Save agenda to localStorage
 * @param {Array} agenda - Agenda items array
 */
export function saveAgenda(agenda) {
  try {
    localStorage.setItem(STORAGE_KEYS.AGENDA, JSON.stringify(agenda));
  } catch (error) {
    console.error('Failed to save agenda:', error);
  }
}

/**
 * Load agenda from localStorage
 * @returns {Array} Agenda items array or empty array
 */
export function loadAgenda() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.AGENDA);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load agenda:', error);
    return [];
  }
}

/**
 * Clear agenda from localStorage
 */
export function clearAgenda() {
  try {
    localStorage.removeItem(STORAGE_KEYS.AGENDA);
  } catch (error) {
    console.error('Failed to clear agenda:', error);
  }
}

/**
 * Save reports to localStorage
 * @param {Array} reports - Reports array
 */
export function saveReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (error) {
    console.error('Failed to save reports:', error);
  }
}

/**
 * Load reports from localStorage
 * @returns {Array} Reports array or empty array
 */
export function loadReports() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.REPORTS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load reports:', error);
    return [];
  }
}

/**
 * Save custom role rules to localStorage
 * @param {Object} roleRules - Role rules object
 */
export function saveRoleRules(roleRules) {
  try {
    localStorage.setItem(STORAGE_KEYS.ROLE_RULES, JSON.stringify(roleRules));
  } catch (error) {
    console.error('Failed to save role rules:', error);
  }
}

/**
 * Load custom role rules from localStorage
 * @returns {Object} Role rules object or null
 */
export function loadRoleRules() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ROLE_RULES);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load role rules:', error);
    return null;
  }
}

/**
 * Clear all stored data
 */
export function clearAllStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear storage:', error);
  }
}
