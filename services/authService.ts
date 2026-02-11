
import { User, UserRole } from '../types';
import { getStore, saveStore } from '../store';

const SESSION_KEY = 'sweepstack_session';

export const authService = {
  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  login: async (username: string): Promise<User> => {
    const store = getStore();
    const user = store.users.find(u => u.username === username);
    if (!user) throw new Error('User not found');
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  register: async (username: string, email: string, role: UserRole, operatorId?: string): Promise<User> => {
    const store = getStore();
    const newUser: User = {
      id: `u-${Date.now()}`,
      username,
      email,
      role,
      operatorId,
      wallet: role === UserRole.PLAYER ? { goldCoins: 1000, sweepsCoins: 5 } : undefined,
      createdAt: new Date().toISOString()
    };
    
    store.users.push(newUser);
    saveStore(store);
    return newUser;
  }
};
