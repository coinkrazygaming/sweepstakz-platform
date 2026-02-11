
export enum UserRole {
  MASTER_ADMIN = 'MASTER_ADMIN',
  OPERATOR = 'OPERATOR',
  PLAYER = 'PLAYER',
  STUDIO_ADMIN = 'STUDIO_ADMIN'
}

export enum CurrencyType {
  GOLD_COIN = 'GC',
  SWEEPS_COIN = 'SC'
}

export enum SlotArchetype {
  CLASSIC_3REEL = 'CLASSIC_3REEL',
  PAYLINES_5X3 = 'PAYLINES_5X3',
  MEGAWAYS = 'MEGAWAYS',
  CLUSTER_PAYS = 'CLUSTER_PAYS',
  HOLD_AND_SPIN = 'HOLD_AND_SPIN',
  CRASH_HYBRID = 'CRASH_HYBRID'
}

export interface Wallet {
  goldCoins: number;
  sweepsCoins: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  operatorId?: string; 
  wallet?: Wallet;
  lastDailyClaim?: string;
  createdAt: string;
}

export interface SymbolWeight {
  symbolId: string;
  weight: number;
}

export interface MathModel {
  rtp: number;
  volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  hitRate: number;
  archetype: SlotArchetype;
  reelStrips: string[][]; 
  paytable: Record<string, number[]>; 
  symbolWeights: SymbolWeight[];
  featureFrequency: number;
  buyBonusMultiplier?: number;
}

export interface GameVisuals {
  symbols: { id: string; name: string; url: string; weight: number }[];
  backgroundUrl: string;
  themeColors: { primary: string; secondary: string; accent: string };
  uiSkins: string; 
  fontFamily: string;
  soundPack: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
  type: 'SLOT' | 'TABLE' | 'CRASH' | 'SKILL';
  imageUrl: string;
  description: string;
  mathModel: MathModel;
  visuals: GameVisuals;
  status: 'DRAFT' | 'PUBLISHED' | 'KILLED';
  sourceId?: string; 
  minBet: number;
}

export interface Operator {
  id: string;
  name: string;
  subdomain: string;
  branding: {
    primaryColor: string;
    logoUrl: string;
    siteName: string;
    themeId?: string;
  };
  active: boolean;
  revenue: number;
  platformFeesPaid: number;
  subscriptionTier: 'BASIC' | 'PRO' | 'ENTERPRISE';
  rtpOverrideEnabled: boolean;
  maxRtpLimit: number;
  assignedGames: string[]; 
  disabledGames: string[]; 
  bonusConfig: {
    welcomeGC: number;
    welcomeSC: number;
    dailyGC: number;
    dailySC: number;
  };
}

export interface ProvablyFairRecord {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  hash: string;
  resultReels: string[];
}

export interface Transaction {
  id: string;
  userId: string;
  operatorId: string;
  amount: number;
  currency: CurrencyType;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  details: string;
  createdAt: string;
}
