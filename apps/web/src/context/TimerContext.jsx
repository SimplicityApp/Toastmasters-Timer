import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_ROLE_RULES, detectRoleFromText, getDefaultGraceAfterRed } from '@toastmaster-timer/shared';
import { calculateStatus, formatTime } from '@toastmaster-timer/shared';
import { saveAgenda, loadAgenda, saveReports, loadReports, saveRoleRules, loadRoleRules, saveRoleOrder, loadRoleOrder, loadHiddenBuiltinRoles, saveHiddenBuiltinRoles, clearAgenda, clearReports } from '@toastmaster-timer/shared';
import { parseEasySpeakText } from '@toastmaster-timer/shared';
import { setPageBackgroundFromStatus } from '../utils/pageBackground';
import { useToast } from './ToastContext';

import { trackEvent } from '../utils/posthog';

const TimerContext = createContext(null);

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
}

export function TimerProvider({ children }) {
  const { showToast } = useToast();

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('blue');
  const [currentSpeaker, setCurrentSpeaker] = useState(null);

  const [agenda, setAgenda] = useState([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const [reports, setReports] = useState([]);

  const [roleRules, setRoleRules] = useState(DEFAULT_ROLE_RULES);
  const [customRoleOrder, setCustomRoleOrder] = useState([]);
  const [hiddenBuiltinRoles, setHiddenBuiltinRoles] = useState([]);

  const intervalRef = useRef(null);
  const previousStatusRef = useRef('blue');

  const BUILT_IN_ORDER = Object.keys(DEFAULT_ROLE_RULES);
  const visibleBuiltins = BUILT_IN_ORDER.filter((r) => !hiddenBuiltinRoles.includes(r));
  const customOrder = customRoleOrder.filter((r) => roleRules[r]);
  const otherCustom = Object.keys(roleRules).filter(
    (r) => !(r in DEFAULT_ROLE_RULES) && !customOrder.includes(r)
  );
  const roleOptions = [...visibleBuiltins, ...customOrder, ...otherCustom];

  useEffect(() => {
    const savedAgenda = loadAgenda();
    const savedReports = loadReports();
    const savedRules = loadRoleRules();
    const savedOrder = loadRoleOrder();
    const savedHidden = loadHiddenBuiltinRoles();

    if (savedAgenda.length > 0) setAgenda(savedAgenda);
    if (savedReports.length > 0) setReports(savedReports);
    const merged = savedRules
      ? { ...DEFAULT_ROLE_RULES, ...savedRules }
      : { ...DEFAULT_ROLE_RULES };
    (savedHidden || []).forEach((r) => delete merged[r]);
    setRoleRules(merged);
    if (savedHidden && savedHidden.length > 0) setHiddenBuiltinRoles(savedHidden);
    if (savedOrder && savedOrder.length > 0) setCustomRoleOrder(savedOrder);
  }, []);

  useEffect(() => {
    if (agenda.length > 0) saveAgenda(agenda);
  }, [agenda]);

  useEffect(() => {
    if (reports.length > 0) saveReports(reports);
  }, [reports]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 0.1;
          if (currentSpeaker && currentSpeaker.rules) {
            const newStatus = calculateStatus(newTime, currentSpeaker.rules);
            setCurrentStatus(newStatus);
            if (newStatus !== previousStatusRef.current) {
              setPageBackgroundFromStatus(newStatus);
              previousStatusRef.current = newStatus;
            }
          }
          return newTime;
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentSpeaker]);

  const startTimer = useCallback(() => {
    if (!currentSpeaker || !currentSpeaker.rules) {
      showToast('Please set timing rules first', 'warning');
      return;
    }
    setIsRunning(true);
    const initialStatus = calculateStatus(0, currentSpeaker.rules);
    setPageBackgroundFromStatus(initialStatus);
    previousStatusRef.current = initialStatus;
  }, [currentSpeaker, showToast]);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setCurrentStatus('blue');
    previousStatusRef.current = 'blue';
    setPageBackgroundFromStatus('blue');
  }, []);

  const setCurrentSpeakerAction = useCallback((speaker) => {
    if (!speaker) {
      setCurrentSpeaker(null);
      resetTimer();
      return;
    }
    const rules = speaker.rules || roleRules[speaker.role] || DEFAULT_ROLE_RULES['Standard Speech'];
    setCurrentSpeaker({ ...speaker, rules });
    resetTimer();
  }, [roleRules, resetTimer]);

  const addToAgenda = useCallback((speaker) => {
    const id = Date.now().toString();
    const rules = speaker.rules || roleRules[speaker.role] || DEFAULT_ROLE_RULES['Standard Speech'];
    setAgenda(prev => [...prev, { id, name: speaker.name, role: speaker.role, rules, completed: false }]);
    trackEvent('speaker_added', { speaker_name: speaker.name || 'Unnamed', role: speaker.role });
    return id;
  }, [roleRules]);

  const removeFromAgenda = useCallback((id) => {
    const itemToRemove = agenda.find(item => item.id === id);
    setAgenda(prev => prev.filter(item => item.id !== id));
    if (activeSpeakerId === id) setActiveSpeakerId(null);
    if (itemToRemove) trackEvent('speaker_removed', { speaker_name: itemToRemove.name || 'Unnamed', role: itemToRemove.role });
  }, [activeSpeakerId, agenda]);

  const reorderAgenda = useCallback((newOrder) => setAgenda(newOrder), []);

  const clearAllAgenda = useCallback(() => {
    const agendaCount = agenda.length;
    setAgenda([]);
    setActiveSpeakerId(null);
    clearAgenda();
    trackEvent('agenda_cleared', { items_count: agendaCount });
  }, [agenda]);

  const markCompleted = useCallback((id) => {
    setAgenda(prev => prev.map(item =>
      item.id === id ? { ...item, completed: true } : item
    ));
  }, []);

  const loadSpeakerFromAgenda = useCallback((id) => {
    const speaker = agenda.find(item => item.id === id);
    if (speaker) {
      const speakerData = { name: speaker.name, role: speaker.role };
      if (speaker.rules) speakerData.rules = speaker.rules;
      setCurrentSpeakerAction(speakerData);
      setActiveSpeakerId(id);
    }
  }, [agenda, setCurrentSpeakerAction]);

  const importBulkSpeakers = useCallback((text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const newItems = lines.map((line, index) => {
      const trimmed = line.trim();
      const role = detectRoleFromText(trimmed, customRoleOrder);
      const name = trimmed.replace(/\(.*?\)/g, '').trim() || `Speaker ${index + 1}`;
      const rules = roleRules[role] || DEFAULT_ROLE_RULES['Standard Speech'];
      return { id: `${Date.now()}-${index}`, name, role, rules, completed: false };
    });
    setAgenda(prev => [...prev, ...newItems]);
    trackEvent('agenda_imported', { import_type: 'bulk', items_count: newItems.length });
    return newItems.length;
  }, [roleRules, customRoleOrder]);

  const importEasySpeakSpeakers = useCallback((text) => {
    const parsedItems = parseEasySpeakText(text);
    const newItems = parsedItems.map((item, index) => {
      const role = item.role;
      const rules = roleRules[role] || DEFAULT_ROLE_RULES['Standard Speech'];
      return { id: `${Date.now()}-${index}`, name: item.name, role, originalShortRole: item.originalShortRole || null, rules, completed: false };
    });
    setAgenda(prev => [...prev, ...newItems]);
    trackEvent('agenda_imported', { import_type: 'easyspeak', items_count: newItems.length });
    return newItems.length;
  }, [roleRules]);

  const formatPassedRedComment = useCallback((elapsedSeconds, redThreshold) => {
    if (elapsedSeconds <= redThreshold) return '';
    const overTime = elapsedSeconds - redThreshold;
    const minutes = Math.floor(overTime / 60);
    const seconds = Math.floor(overTime % 60);
    if (minutes > 0) {
      if (seconds > 0) return `Passed red by ${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`;
      return `Passed red by ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `Passed red by ${seconds} second${seconds > 1 ? 's' : ''}`;
  }, []);

  const formatBeforeGreenComment = useCallback((elapsedSeconds, greenThreshold) => {
    if (elapsedSeconds >= greenThreshold) return '';
    const underTime = greenThreshold - elapsedSeconds;
    const minutes = Math.floor(underTime / 60);
    const seconds = Math.floor(underTime % 60);
    if (minutes > 0) {
      if (seconds > 0) return `Finished ${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''} before green`;
      return `Finished ${minutes} minute${minutes > 1 ? 's' : ''} before green`;
    }
    return `Finished ${seconds} second${seconds > 1 ? 's' : ''} before green`;
  }, []);

  const addReport = useCallback((entry) => {
    setReports(prev => [...prev, {
      name: entry.name,
      role: entry.role,
      duration: formatTime(entry.duration),
      color: entry.color,
      comments: entry.comments || '',
      disqualified: entry.disqualified === true
    }]);
  }, []);

  const clearAllReports = useCallback(() => {
    setReports([]);
    clearReports();
  }, []);

  const finishCurrentSpeech = useCallback(() => {
    if (currentSpeaker && elapsedTime > 0) {
      const rules = currentSpeaker.rules;
      const grace = rules ? (rules.graceAfterRed ?? getDefaultGraceAfterRed(currentSpeaker.role)) : 30;
      const disqualified = rules ? elapsedTime > rules.red + grace : false;
      let comment = '';
      if (rules) {
        if (elapsedTime > rules.red) {
          comment = formatPassedRedComment(elapsedTime, rules.red);
          if (disqualified) comment += ' (Disqualified)';
        } else if (elapsedTime < rules.green) {
          comment = formatBeforeGreenComment(elapsedTime, rules.green);
        }
      }
      addReport({ name: currentSpeaker.name, role: currentSpeaker.role, duration: elapsedTime, color: currentStatus, comments: comment, disqualified });
      trackEvent('speech_finished', { speaker_name: currentSpeaker.name || 'Unnamed', role: currentSpeaker.role, duration: elapsedTime, final_status: currentStatus });
      if (activeSpeakerId) markCompleted(activeSpeakerId);
      resetTimer();
      setActiveSpeakerId(null);
    }
  }, [currentSpeaker, elapsedTime, currentStatus, activeSpeakerId, addReport, markCompleted, resetTimer, formatPassedRedComment, formatBeforeGreenComment]);

  const updateRoleRules = useCallback((role, rules) => {
    setRoleRules(prev => {
      const updated = { ...prev, [role]: rules };
      saveRoleRules(updated);
      return updated;
    });
  }, []);

  const addRoleRules = useCallback((role, rules) => {
    setRoleRules(prev => {
      const updated = { ...prev, [role]: rules };
      saveRoleRules(updated);
      return updated;
    });
    setCustomRoleOrder(prev => {
      if (prev.includes(role)) return prev;
      const next = [...prev, role];
      saveRoleOrder(next);
      return next;
    });
  }, []);

  const removeRoleRules = useCallback((role) => {
    if (role in DEFAULT_ROLE_RULES) {
      setHiddenBuiltinRoles(prev => {
        if (prev.includes(role)) return prev;
        saveHiddenBuiltinRoles([...prev, role]);
        return [...prev, role];
      });
      setRoleRules(prev => {
        const { [role]: _, ...rest } = prev;
        saveRoleRules(rest);
        return rest;
      });
      return;
    }
    setRoleRules(prev => {
      const { [role]: _, ...rest } = prev;
      saveRoleRules(rest);
      return rest;
    });
    setCustomRoleOrder(prev => {
      const next = prev.filter((r) => r !== role);
      saveRoleOrder(next);
      return next;
    });
  }, []);

  const resetAllRoleRulesToDefaults = useCallback(() => {
    setHiddenBuiltinRoles([]);
    saveHiddenBuiltinRoles([]);
    setRoleRules(prev => {
      const customOnly = Object.fromEntries(Object.entries(prev).filter(([r]) => !(r in DEFAULT_ROLE_RULES)));
      const updated = { ...DEFAULT_ROLE_RULES, ...customOnly };
      saveRoleRules(updated);
      return updated;
    });
  }, []);

  const value = {
    isRunning, elapsedTime, currentStatus, currentSpeaker,
    agenda, activeSpeakerId, reports, roleRules, roleOptions,
    startTimer, stopTimer, resetTimer, setCurrentSpeaker: setCurrentSpeakerAction,
    addToAgenda, removeFromAgenda, reorderAgenda, markCompleted, loadSpeakerFromAgenda,
    importBulkSpeakers, importEasySpeakSpeakers, clearAllAgenda,
    addReport, finishCurrentSpeech, clearAllReports,
    updateRoleRules, addRoleRules, removeRoleRules, resetAllRoleRulesToDefaults,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}
