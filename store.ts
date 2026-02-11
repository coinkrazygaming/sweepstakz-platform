
import { User, Operator, UserRole, Game, AuditLog, Transaction, SlotArchetype } from './types';

const STORAGE_KEY = 'sweepstack_studio_v1';

interface AppData {
  users: User[];
  operators: Operator[];
  globalGames: Game[];
  auditLogs: AuditLog[];
  transactions: Transaction[];
}

const DEFAULT_MATH: any = {
  rtp: 96.5,
  volatility: 'MEDIUM',
  archetype: SlotArchetype.PAYLINES_5X3,
  hitRate: 28.5,
  reelStrips: [
    ['💎', '🍒', '🍋', '🔔', '7️⃣'],
    ['7️⃣', '💎', '🍒', '🍋', '🔔'],
    ['🔔', '7️⃣', '💎', '🍒', '🍋']
  ],
  paytable: {
    '💎': [5, 20, 100],
    '7️⃣': [10, 50, 500],
    '🍒': [2, 5, 15]
  },
  symbolWeights: [
    { symbolId: 's1', weight: 10 },
    { symbolId: 's2', weight: 5 }
  ],
  featureFrequency: 120,
  buyBonusMultiplier: 80
};

const DEFAULT_VISUALS: any = {
  symbols: [
    { id: 's1', name: 'Diamond', url: 'https://images.unsplash.com/photo-1596838132731-dd9673059517', weight: 10 },
    { id: 's2', name: 'Seven', url: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d', weight: 5 }
  ],
  backgroundUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f',
  themeColors: { primary: '#6366f1', secondary: '#4f46e5', accent: '#f0abfc' },
  uiSkins: 'modern'
};

const DEFAULT_DATA: AppData = {
  users: [
    { id: 'master-1', username: 'corey', email: 'corey@sweepstack.io', role: UserRole.MASTER_ADMIN, createdAt: new Date().toISOString() }
  ],
  operators: [
    {
      id: 'op-1',
      name: 'Vegas Shard',
      subdomain: 'vegas',
      branding: { primaryColor: '#6366f1', logoUrl: '', siteName: 'Vegas Dreams' },
      active: true,
      revenue: 250000,
      platformFeesPaid: 25000,
      subscriptionTier: 'PRO',
      rtpOverrideEnabled: true,
      maxRtpLimit: 98.0,
      assignedGames: ['g-1'],
      disabledGames: [],
      bonusConfig: { welcomeGC: 10000, welcomeSC: 10, dailyGC: 2500, dailySC: 1 }
      // Fix: Removed billingConfig as it is not defined in the Operator interface in types.ts
    }
  ],
  globalGames: [
    {
      id: 'g-1',
      name: 'Cosmic Reels (Native)',
      slug: 'cosmic-reels',
      type: 'SLOT',
      imageUrl: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d',
      description: 'High-fidelity sharded slot experience.',
      mathModel: DEFAULT_MATH,
      visuals: DEFAULT_VISUALS,
      status: 'PUBLISHED',
      minBet: 1
    }
  ],
  auditLogs: [],
  transactions: []
};

export const getStore = (): AppData => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return DEFAULT_DATA;
  return JSON.parse(data);
};

export const saveStore = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const createAuditLog = (action: string, actorId: string, details: string): AuditLog => ({
  id: `log-${Date.now()}`,
  action,
  actorId,
  details,
  createdAt: new Date().toISOString()
});
