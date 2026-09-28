import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessions, getField } from '../services/api';

const SessionContext = createContext(null);
const ACTIVE_SESSION_KEY = '@crick_grid_active_session_id';

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSessionInternal] = useState(null);
  const [fieldPositions, setFieldPositions] = useState(null);
  const [fieldDiameter, setFieldDiameter] = useState(65);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState(null);

  // Track which session's field is loaded so we don't over-fetch
  const fieldSessionRef = useRef(null);

  // ── Fetch all sessions ───────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const res = await getSessions();
      const data = res.data.data || [];
      setSessions(data);

      const savedId = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);

      setActiveSessionInternal(prev => {
        const targetId = prev?.id || savedId;
        if (targetId) {
          const refreshed = data.find(s => String(s.id) === String(targetId));
          if (refreshed) return refreshed;
        }
        return prev || (data.length > 0 ? data[0] : null);
      });
    } catch {
      setError(
        'Could not connect to server. Check your IP in api.js and that the backend is running.'
      );
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // ── Fetch field for a specific session ───────────────────────────────────
  const fetchField = useCallback(async (sessionId) => {
    if (!sessionId) {
      setFieldPositions(null);
      setFieldDiameter(65);
      fieldSessionRef.current = null;
      return;
    }
    try {
      const res = await getField(sessionId);
      const data = res.data.data;

      // Strict ownership check — only apply if it belongs to THIS session
      if (data && data.session_id === sessionId) {
        setFieldPositions(data.positions);
        setFieldDiameter(parseFloat(data.field_diameter) || 65);
      } else {
        // No field saved for this session yet — use null (not stale data)
        setFieldPositions(null);
        setFieldDiameter(65);
      }
      fieldSessionRef.current = sessionId;
    } catch {
      setFieldPositions(null);
      setFieldDiameter(65);
      fieldSessionRef.current = sessionId;
    }
  }, []);

  // Force-refresh field (ignores the "already loaded" cache)
  const refreshField = useCallback(async (sessionId) => {
    fieldSessionRef.current = null;
    await fetchField(sessionId);
  }, [fetchField]);

  // ── When active session changes, hard-clear then reload field ────────────
  useEffect(() => {
    if (activeSession?.id) {
      // Immediately clear stale field from previous session
      setFieldPositions(null);
      setFieldDiameter(65);
      fieldSessionRef.current = null;
      // Then fetch this session's persisted field
      fetchField(activeSession.id);
    } else {
      setFieldPositions(null);
      setFieldDiameter(65);
      fieldSessionRef.current = null;
    }
  }, [activeSession?.id]);

  // Initial load
  useEffect(() => { fetchSessions(); }, []);

  // ── setActiveSession — always clears field before switching ─────────────
  const setActiveSession = useCallback((session) => {
    setFieldPositions(null);
    setFieldDiameter(65);
    fieldSessionRef.current = null;
    if (session?.id) {
      AsyncStorage.setItem(ACTIVE_SESSION_KEY, String(session.id)).catch(() => {});
    }
    setActiveSessionInternal(session);
  }, []);

  return (
    <SessionContext.Provider value={{
      sessions,
      activeSession,
      setActiveSession,
      fieldPositions,
      fieldDiameter,
      refreshField,
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