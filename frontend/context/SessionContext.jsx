import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSessions, getField } from '../services/api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSessionState] = useState(null);
  const [fieldPositions, setFieldPositions] = useState(null);
  const [fieldDiameter, setFieldDiameter] = useState(65);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const res = await getSessions();
      const data = res.data.data || [];
      setSessions(data);
      setActiveSessionState(prev => {
        if (prev) {
          const refreshed = data.find(s => s.id === prev.id);
          return refreshed || prev;
        }
        return data.length > 0 ? data[0] : null;
      });
    } catch (e) {
      setError('Could not connect to server. Check your IP in api.js and that the backend is running.');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchField = useCallback(async (sessionId) => {
    if (!sessionId) {
      setFieldPositions(null);
      setFieldDiameter(65);
      return;
    }
    try {
      // Always fetch fresh from backend for this specific session
      const res = await getField(sessionId);
      if (res.data.data && res.data.data.session_id === sessionId) {
        setFieldPositions(res.data.data.positions);
        setFieldDiameter(res.data.data.field_diameter || 65);
      } else {
        // No field set for this session yet
        setFieldPositions(null);
        setFieldDiameter(65);
      }
    } catch {
      setFieldPositions(null);
      setFieldDiameter(65);
    }
  }, []);

  // When active session changes: CLEAR field first, then fetch this session's field
  useEffect(() => {
    if (activeSession?.id) {
      // Clear immediately so stale field from previous session isn't shown
      setFieldPositions(null);
      setFieldDiameter(65);
      fetchField(activeSession.id);
    } else {
      setFieldPositions(null);
      setFieldDiameter(65);
    }
  }, [activeSession?.id]);

  useEffect(() => { fetchSessions(); }, []);

  // Wrap setActiveSession to always clear field on switch
  const setActiveSession = useCallback((session) => {
    setFieldPositions(null);
    setFieldDiameter(65);
    setActiveSessionState(session);
  }, []);

  return (
    <SessionContext.Provider value={{
      sessions,
      activeSession,
      setActiveSession,
      fieldPositions,
      fieldDiameter,
      refreshField: fetchField,
      loadingSessions,
      error,
      refreshSessions: fetchSessions,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}