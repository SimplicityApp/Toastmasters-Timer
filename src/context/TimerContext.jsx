import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_ROLE_RULES, detectRoleFromText } from '../constants/timingRules';
import { calculateStatus, formatTime } from '../utils/timerLogic';
import { saveAgenda, loadAgenda, saveReports, loadReports, saveRoleRules, loadRoleRules, clearAgenda, clearReports } from '../utils/storage';
import { applyOverlay, getBackgroundUrl } from '../utils/zoomSdk';
import { parseEasySpeakText } from '../utils/easySpeakParser';

const TimerContext = createContext(null);

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
}

export function TimerProvider({ children }) {
  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('white');
  const [currentSpeaker, setCurrentSpeaker] = useState(null);

  // Agenda state
  const [agenda, setAgenda] = useState([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  // Reports state
  const [reports, setReports] = useState([]);

  // Role rules (can be customized)
  const [roleRules, setRoleRules] = useState(DEFAULT_ROLE_RULES);

  // Timer interval ref
  const intervalRef = useRef(null);
  const previousStatusRef = useRef('white');

  // Load data from localStorage on mount
  useEffect(() => {
    const savedAgenda = loadAgenda();
    const savedReports = loadReports();
    const savedRules = loadRoleRules();

    if (savedAgenda.length > 0) {
      setAgenda(savedAgenda);
    }
    if (savedReports.length > 0) {
      setReports(savedReports);
    }
    if (savedRules) {
      setRoleRules({ ...DEFAULT_ROLE_RULES, ...savedRules });
    }
  }, []);

  // Save agenda to localStorage whenever it changes
  useEffect(() => {
    if (agenda.length > 0) {
      saveAgenda(agenda);
    }
  }, [agenda]);

  // Save reports to localStorage whenever they change
  useEffect(() => {
    if (reports.length > 0) {
      saveReports(reports);
    }
  }, [reports]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 0.1;
          
          // Calculate status if we have a current speaker
          if (currentSpeaker && currentSpeaker.rules) {
            const newStatus = calculateStatus(newTime, currentSpeaker.rules);
            setCurrentStatus(newStatus);

            // Trigger Zoom overlay change when status changes
            if (newStatus !== previousStatusRef.current) {
              applyOverlay(getBackgroundUrl(newStatus));
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, currentSpeaker]);

  // Timer actions
  const startTimer = useCallback(() => {
    // Speaker name is optional, but we need rules to run the timer
    if (!currentSpeaker || !currentSpeaker.rules) {
      alert('Please set timing rules first');
      return;
    }
    setIsRunning(true);
    // Apply initial overlay when timer starts (status will be 'white' initially)
    const initialStatus = calculateStatus(0, currentSpeaker.rules);
    applyOverlay(getBackgroundUrl(initialStatus));
    previousStatusRef.current = initialStatus;
  }, [currentSpeaker]);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setCurrentStatus('white');
    previousStatusRef.current = 'white';
    applyOverlay(getBackgroundUrl('white'));
  }, []);

  // Speaker management
  const setCurrentSpeakerAction = useCallback((speaker) => {
    if (!speaker) {
      setCurrentSpeaker(null);
      resetTimer();
      return;
    }

    // If rules are already provided (e.g., for Custom role), use them
    // Otherwise, get rules from roleRules
    const rules = speaker.rules || roleRules[speaker.role] || DEFAULT_ROLE_RULES['Standard Speech'];
    const speakerWithRules = {
      ...speaker,
      rules
    };

    setCurrentSpeaker(speakerWithRules);
    resetTimer();
  }, [roleRules, resetTimer]);

  // Agenda management
  const addToAgenda = useCallback((speaker) => {
    const id = Date.now().toString();
    // Use custom rules if provided (for Custom role), otherwise use roleRules
    const rules = speaker.rules || roleRules[speaker.role] || DEFAULT_ROLE_RULES['Standard Speech'];
    const newItem = {
      id,
      name: speaker.name,
      role: speaker.role,
      rules,
      completed: false
    };
    setAgenda(prev => [...prev, newItem]);
    return id;
  }, [roleRules]);

  const removeFromAgenda = useCallback((id) => {
    setAgenda(prev => prev.filter(item => item.id !== id));
    if (activeSpeakerId === id) {
      setActiveSpeakerId(null);
    }
  }, [activeSpeakerId]);

  const reorderAgenda = useCallback((newOrder) => {
    setAgenda(newOrder);
  }, []);

  const clearAllAgenda = useCallback(() => {
    setAgenda([]);
    setActiveSpeakerId(null);
    clearAgenda();
  }, []);

  const markCompleted = useCallback((id) => {
    setAgenda(prev => prev.map(item => 
      item.id === id ? { ...item, completed: true } : item
    ));
  }, []);

  const loadSpeakerFromAgenda = useCallback((id) => {
    const speaker = agenda.find(item => item.id === id);
    if (speaker) {
      const speakerData = {
        name: speaker.name,
        role: speaker.role
      };
      // Include rules if they exist (for Custom role or any customized rules)
      if (speaker.rules) {
        speakerData.rules = speaker.rules;
      }
      setCurrentSpeakerAction(speakerData);
      setActiveSpeakerId(id);
    }
  }, [agenda, setCurrentSpeakerAction]);

  // Simple format bulk import
  const importBulkSpeakers = useCallback((text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const newItems = lines.map((line, index) => {
      const trimmed = line.trim();
      const role = detectRoleFromText(trimmed);
      const name = trimmed.replace(/\(.*?\)/g, '').trim() || `Speaker ${index + 1}`;
      const rules = roleRules[role] || DEFAULT_ROLE_RULES['Standard Speech'];
      
      return {
        id: `${Date.now()}-${index}`,
        name,
        role,
        rules,
        completed: false
      };
    });

    setAgenda(prev => [...prev, ...newItems]);
    return newItems.length;
  }, [roleRules]);

  // EasySpeak format bulk import
  const importEasySpeakSpeakers = useCallback((text) => {
    const parsedItems = parseEasySpeakText(text);
    const newItems = parsedItems.map((item, index) => {
      const role = item.role;
      const rules = roleRules[role] || DEFAULT_ROLE_RULES['Standard Speech'];
      
      return {
        id: `${Date.now()}-${index}`,
        name: item.name,
        role,
        rules,
        completed: false
      };
    });

    setAgenda(prev => [...prev, ...newItems]);
    return newItems.length;
  }, [roleRules]);

  // Helper function to format "passed red" comment
  const formatPassedRedComment = useCallback((elapsedSeconds, redThreshold) => {
    if (elapsedSeconds <= redThreshold) {
      return '';
    }
    
    const overTime = elapsedSeconds - redThreshold;
    const minutes = Math.floor(overTime / 60);
    const seconds = Math.floor(overTime % 60);
    
    if (minutes > 0) {
      if (seconds > 0) {
        return `Passed red by ${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`;
      } else {
        return `Passed red by ${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    } else {
      return `Passed red by ${seconds} second${seconds > 1 ? 's' : ''}`;
    }
  }, []);

  // Helper function to format "finished before green" comment
  const formatBeforeGreenComment = useCallback((elapsedSeconds, greenThreshold) => {
    if (elapsedSeconds >= greenThreshold) {
      return '';
    }
    
    const underTime = greenThreshold - elapsedSeconds;
    const minutes = Math.floor(underTime / 60);
    const seconds = Math.floor(underTime % 60);
    
    if (minutes > 0) {
      if (seconds > 0) {
        return `Finished ${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''} before green`;
      } else {
        return `Finished ${minutes} minute${minutes > 1 ? 's' : ''} before green`;
      }
    } else {
      return `Finished ${seconds} second${seconds > 1 ? 's' : ''} before green`;
    }
  }, []);

  // Report management
  const addReport = useCallback((entry) => {
    const reportEntry = {
      name: entry.name,
      role: entry.role,
      duration: formatTime(entry.duration),
      color: entry.color,
      comments: entry.comments || ''
    };
    setReports(prev => [...prev, reportEntry]);
  }, []);

  const clearAllReports = useCallback(() => {
    setReports([]);
    clearReports();
  }, []);

  const finishCurrentSpeech = useCallback(() => {
    if (currentSpeaker && elapsedTime > 0) {
      // Calculate comment if speaker passed red or finished before green
      let comment = '';
      if (currentSpeaker.rules) {
        if (elapsedTime > currentSpeaker.rules.red) {
          comment = formatPassedRedComment(elapsedTime, currentSpeaker.rules.red);
        } else if (elapsedTime < currentSpeaker.rules.green) {
          comment = formatBeforeGreenComment(elapsedTime, currentSpeaker.rules.green);
        }
      }

      addReport({
        name: currentSpeaker.name,
        role: currentSpeaker.role,
        duration: elapsedTime,
        color: currentStatus,
        comments: comment
      });

      // Mark as completed in agenda if it exists
      if (activeSpeakerId) {
        markCompleted(activeSpeakerId);
      }

      // Reset timer
      resetTimer();
      setActiveSpeakerId(null);
    }
  }, [currentSpeaker, elapsedTime, currentStatus, activeSpeakerId, addReport, markCompleted, resetTimer, formatPassedRedComment, formatBeforeGreenComment]);

  // Role rules management
  const updateRoleRules = useCallback((role, rules) => {
    setRoleRules(prev => {
      const updated = { ...prev, [role]: rules };
      saveRoleRules(updated);
      return updated;
    });
  }, []);

  const value = {
    // Timer state
    isRunning,
    elapsedTime,
    currentStatus,
    currentSpeaker,
    
    // Agenda state
    agenda,
    activeSpeakerId,
    
    // Reports state
    reports,
    
    // Role rules
    roleRules,
    
    // Timer actions
    startTimer,
    stopTimer,
    resetTimer,
    
    // Speaker actions
    setCurrentSpeaker: setCurrentSpeakerAction,
    
    // Agenda actions
    addToAgenda,
    removeFromAgenda,
    reorderAgenda,
    markCompleted,
    loadSpeakerFromAgenda,
    importBulkSpeakers,
    importEasySpeakSpeakers,
    clearAllAgenda,
    
    // Report actions
    addReport,
    finishCurrentSpeech,
    clearAllReports,
    
    // Role rules actions
    updateRoleRules,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}
