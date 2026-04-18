// ============================================================
// Auth Context — global session + master key state
// ============================================================
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { deriveMasterKey } from '../utils/crypto';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('sc_user') || 'null'); }
    catch { return null; }
  });

  // masterKey is NEVER serialized — lives only in memory
  const masterKeyRef = useRef(null);

  const getMasterKey = () => masterKeyRef.current;

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });

    // Derive master key from password + server-provided salt
    // Must happen before setting auth state
    const key = await deriveMasterKey(password, data.user.salt);
    masterKeyRef.current = key;

    localStorage.setItem('sc_access_token',  data.accessToken);
    localStorage.setItem('sc_refresh_token', data.refreshToken);
    localStorage.setItem('sc_user', JSON.stringify(data.user));
    setUser(data.user);

    return data;
  }, []);

  const register = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/register', { email, password });

    const key = await deriveMasterKey(password, data.user.salt);
    masterKeyRef.current = key;

    localStorage.setItem('sc_access_token',  data.accessToken);
    localStorage.setItem('sc_refresh_token', data.refreshToken);
    localStorage.setItem('sc_user', JSON.stringify(data.user));
    setUser(data.user);

    return data;
  }, []);

  const logout = useCallback(() => {
    masterKeyRef.current = null;   // wipe key from memory
    localStorage.removeItem('sc_access_token');
    localStorage.removeItem('sc_refresh_token');
    localStorage.removeItem('sc_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, getMasterKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
