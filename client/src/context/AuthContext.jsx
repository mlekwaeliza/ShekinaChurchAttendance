import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkAuth();
    return () => { mountedRef.current = false; };
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      if (mountedRef.current) {
        setUser(response.data.user);
      }
    } catch (error) {
      if (mountedRef.current) {
        setUser(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const login = async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API failed, forcing client logout:', error);
    } finally {
      setUser(null);
    }
  };

  const updateUser = (data) => {
    if (data && typeof data === 'object') {
      setUser(prev => ({ ...prev, ...data }));
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
