import { create } from 'zustand';
import type { UserPublic } from '@storybook/shared';
import { api, setAuthToken } from '../api/client';
import { storage } from '../lib/storage';

const TOKEN_KEY = 'sb_token';

interface AuthState {
  token: string | null;
  user: UserPublic | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  ready: false,

  bootstrap: async () => {
    const token = await storage.getItem(TOKEN_KEY);
    if (token) {
      setAuthToken(token);
      try {
        const user = await api.me();
        set({ token, user });
      } catch {
        await storage.deleteItem(TOKEN_KEY);
        setAuthToken(null);
      }
    }
    set({ ready: true });
  },

  login: async (email, password) => {
    const r = await api.login(email, password);
    await storage.setItem(TOKEN_KEY, r.token);
    setAuthToken(r.token);
    set({ token: r.token, user: r.user });
  },

  register: async (email, password, name) => {
    const r = await api.register(email, password, name);
    await storage.setItem(TOKEN_KEY, r.token);
    setAuthToken(r.token);
    set({ token: r.token, user: r.user });
  },

  logout: async () => {
    await storage.deleteItem(TOKEN_KEY);
    setAuthToken(null);
    set({ token: null, user: null });
  },
}));
