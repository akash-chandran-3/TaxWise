// Holds the logged-in user and token, and shares them with every component.
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Read the token once on startup so a page refresh keeps you logged in.
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  function login(newToken, newUser) {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  // Check a stored token with the server. If it has expired, log out.
  useEffect(() => {
    if (!token) return;
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.status === 401) logout();
      });
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
