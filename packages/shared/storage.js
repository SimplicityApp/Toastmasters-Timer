const STORAGE_KEYS = {
  AGENDA: 'toastmaster_agenda',
  REPORTS: 'toastmaster_reports',
  ROLE_RULES: 'toastmaster_role_rules',
  ROLE_ORDER: 'toastmaster_role_order',
  HIDDEN_BUILTIN_ROLES: 'toastmaster_hidden_builtin_roles',
  OVERLAY_MODE: 'toastmaster_overlay_mode',
  TIME_INPUT_MODE: 'toastmaster_time_input_mode',
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
 * Clear reports from localStorage
 */
export function clearReports() {
  try {
    localStorage.removeItem(STORAGE_KEYS.REPORTS);
  } catch (error) {
    console.error('Failed to clear reports:', error);
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
 * Load custom role names order from localStorage (user-added roles only, in order)
 * @returns {string[]} Array of custom role names or empty array
 */
export function loadRoleOrder() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ROLE_ORDER);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load role order:', error);
    return [];
  }
}

/**
 * Save custom role names order to localStorage
 * @param {string[]} order - Array of custom role names
 */
export function saveRoleOrder(order) {
  try {
    localStorage.setItem(STORAGE_KEYS.ROLE_ORDER, JSON.stringify(order));
  } catch (error) {
    console.error('Failed to save role order:', error);
  }
}

/**
 * Load hidden built-in role names from localStorage (removed by user; restored by "Reset All to Defaults")
 * @returns {string[]} Array of built-in role names to hide
 */
export function loadHiddenBuiltinRoles() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HIDDEN_BUILTIN_ROLES);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load hidden built-in roles:', error);
    return [];
  }
}

/**
 * Save hidden built-in role names to localStorage
 * @param {string[]} hidden - Array of built-in role names to hide
 */
export function saveHiddenBuiltinRoles(hidden) {
  try {
    localStorage.setItem(STORAGE_KEYS.HIDDEN_BUILTIN_ROLES, JSON.stringify(hidden));
  } catch (error) {
    console.error('Failed to save hidden built-in roles:', error);
  }
}

/**
 * Save overlay mode to localStorage
 * @param {string} mode - Overlay mode ('card' or 'camera')
 */
export function saveOverlayMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEYS.OVERLAY_MODE, mode);
  } catch (error) {
    console.error('Failed to save overlay mode:', error);
  }
}

/**
 * Load overlay mode from localStorage
 * @returns {string|null} Overlay mode or null
 */
export function loadOverlayMode() {
  try {
    return localStorage.getItem(STORAGE_KEYS.OVERLAY_MODE);
  } catch (error) {
    console.error('Failed to load overlay mode:', error);
    return null;
  }
}

/**
 * Save time input mode to localStorage
 * @param {string} mode - 'minsec' or 'seconds'
 */
export function saveTimeInputMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEYS.TIME_INPUT_MODE, mode);
  } catch (error) {
    console.error('Failed to save time input mode:', error);
  }
}

/**
 * Load time input mode from localStorage
 * @returns {string} 'minsec' or 'seconds' (defaults to 'minsec')
 */
export function loadTimeInputMode() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TIME_INPUT_MODE) || 'minsec';
  } catch (error) {
    console.error('Failed to load time input mode:', error);
    return 'minsec';
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
