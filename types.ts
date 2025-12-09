
export enum UserRole {
  ADMIN = 'ADMIN',
  AFFILIATE = 'AFFILIATE'
}

export enum Tier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD'
}

export enum TaskStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED'
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PAID = 'PAID'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  // Affiliate specific fields
  tier?: Tier;
  totalEarnings?: number;
  pendingEarnings?: number;
  totalClicks?: number; // Added
  validClicks?: number; // Added
  socialLinks?: {
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    instagram?: string;
  };
  followerCount?: number;
  walletAddress?: string; // USDT
}

export interface Task {
  id: string;
  title: string;
  description: string;
  productLink: string;
  rewardRate: number; // e.g., 50 (dollars per 1000 clicks)
  status: TaskStatus;
  createdAt: string;
  deadline: string;
  requirements: string[];
}

// The connection between an Affiliate and a Task
export interface AffiliateTask {
  id: string;
  affiliateId: string;
  taskId: string;
  uniqueTrackingLink: string;
  submittedPostLink?: string; // The link the affiliate posts (tweet, video)
  status: 'CLAIMED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  stats: {
    totalClicks: number;
    validClicks: number; // Anti-cheat filtered
    conversionRate: number;
    estimatedEarnings: number;
  };
}

export interface Settlement {
  id: string;
  affiliateId: string;
  affiliateName: string;
  amount: number;
  period: string; // e.g., "2023-10"
  status: SettlementStatus;
  transactionHash?: string;
  date: string;
}

export const TIER_RATES = {
  [Tier.BRONZE]: 50,
  [Tier.SILVER]: 80,
  [Tier.GOLD]: 100
};

export const TIER_THRESHOLDS = {
  [Tier.BRONZE]: 0,
  [Tier.SILVER]: 10000, // clicks
  [Tier.GOLD]: 50000  // clicks
};
