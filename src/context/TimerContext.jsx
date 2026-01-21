import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_ROLE_RULES, detectRoleFromText } from '../constants/timingRules';
import { calculateStatus, formatTime } from '../utils/timerLogic';
import { saveAgenda, loadAgenda, saveReports, loadReports, saveRoleRules, loadRoleRules } from '../utils/storage';
import { setVirtualBackground } from '../utils/zoomSdk';

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

            // Trigger Zoom background change when status changes
            if (newStatus !== previousStatusRef.current) {
              setVirtualBackground(newStatus);
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
  }, [currentSpeaker]);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setCurrentStatus('white');
    previousStatusRef.current = 'white';
    setVirtualBackground('white');
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
    const rules = roleRules[speaker.role] || DEFAULT_ROLE_RULES['Standard Speech'];
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

  const markCompleted = useCallback((id) => {
    setAgenda(prev => prev.map(item => 
      item.id === id ? { ...item, completed: true } : item
    ));
  }, []);

  const loadSpeakerFromAgenda = useCallback((id) => {
    const speaker = agenda.find(item => item.id === id);
    if (speaker) {
      setCurrentSpeakerAction({
        name: speaker.name,
        role: speaker.role
      });
      setActiveSpeakerId(id);
    }
  }, [agenda, setCurrentSpeakerAction]);

  // Bulk import
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

  // Report management
  const addReport = useCallback((entry) => {
    const reportEntry = {
      name: entry.name,
      role: entry.role,
      duration: formatTime(entry.duration),
      color: entry.color
    };
    setReports(prev => [...prev, reportEntry]);
  }, []);

  const finishCurrentSpeech = useCallback(() => {
    if (currentSpeaker && elapsedTime > 0) {
      addReport({
        name: currentSpeaker.name,
        role: currentSpeaker.role,
        duration: elapsedTime,
        color: currentStatus
      });

      // Mark as completed in agenda if it exists
      if (activeSpeakerId) {
        markCompleted(activeSpeakerId);
      }

      // Reset timer
      resetTimer();
      setActiveSpeakerId(null);
    }
  }, [currentSpeaker, elapsedTime, currentStatus, activeSpeakerId, addReport, markCompleted, resetTimer]);

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
    
    // Report actions
    addReport,
    finishCurrentSpeech,
    
    // Role rules actions
    updateRoleRules,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}
