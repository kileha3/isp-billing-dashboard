"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  isRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    // Initialize token synchronously from storage (client-side only)
    if (typeof window !== "undefined") {
      return apiClient.getToken();
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token and fetch user on mount
    const currentToken = apiClient.getToken();
    
    if (currentToken) {
      setToken(currentToken);
      apiClient.auth.me()
        .then((user) => setUser(user))
        .catch(() => {
          // Token is invalid - clear it
          apiClient.auth.logout();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loading]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
    // apiClient.auth.login automatically stores the token
    const data = await apiClient.auth.login(email, password, rememberMe);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    apiClient.auth.logout();
    setToken(null);
    setUser(null);
  }, []);

  const isRole = useCallback((...roles: string[]) => {
    return !!user && roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
