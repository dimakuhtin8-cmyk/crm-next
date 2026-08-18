'use client';

import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const [error, setError] = useState<string | null>(null);

  const user: User | null = session?.user
    ? {
        id: (session.user as { id?: string }).id ?? '',
        email: session.user.email ?? '',
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      }
    : null;

  const loading = status === 'loading';

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await fetch('/uk/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        throw new Error(data.error);
      }

      await update();
    } catch (err: unknown) {
      const message = (err as { message?: string }).message || 'Помилка входу';
      setError(message);
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const res = await fetch('/uk/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        throw new Error(data.error);
      }

      await login(email, password);
    } catch (err: unknown) {
      const message = (err as { message?: string }).message || 'Помилка реєстрації';
      setError(message);
      throw err;
    }
  };

  const loginGoogle = async () => {
    setError(null);
    window.location.href = '/uk/api/auth/signin/google?callbackUrl=/dashboard';
  };

  const logout = async () => {
    setError(null);
    await nextAuthSignOut({ callbackUrl: '/uk/auth/login' });
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, register, loginGoogle, logout, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}