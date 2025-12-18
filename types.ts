
export enum UserRole {
  ADMIN = 'ADMIN',
  AFFILIATE = 'AFFILIATE'
}

export enum Tier {
  CORE_PARTNER = 'CORE_PARTNER',           // 基础合作伙伴
  PREMIUM_INFLUENCER = 'PREMIUM_INFLUENCER', // 高级影响者
  OFFICIAL_COLLABORATOR = 'OFFICIAL_COLLABORATOR' // 官方合作者
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

export enum WithdrawalStatus {
  PENDING = 'PENDING',       // 待处理
  PROCESSING = 'PROCESSING', // 处理中
  COMPLETED = 'COMPLETED',   // 已完成
  REJECTED = 'REJECTED'      // 已拒绝
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
    linkedin?: string;
    reddit?: string;
    facebook?: string;
    twitch?: string;
    discord?: string;
  };
  followerCount?: number;
  walletAddress?: string; // USDT
  tags?: string[]; // 达人标签分类（AI博主、时尚博主等）
  // 通知设置
  notificationSettings?: {
    newTaskAlert: boolean; // 是否接收新任务提醒
  };
  lastSeenTaskTimestamp?: string; // 用户最后查看任务的时间戳
}

export interface Task {
  id: string;
  title: string;
  description: string;
  productLink: string;
  isSpecialReward: boolean; // Whether using custom special rewards or default TIER_RATES
  specialRewards?: {
    CORE_PARTNER: number;
    PREMIUM_INFLUENCER: number;
    OFFICIAL_COLLABORATOR: number;
  }; // Custom reward rates per tier (dollars per 1000 clicks)
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
  submittedPostLink?: string; // 🔧 保留旧字段以保持兼容性 - The link the affiliate posts (tweet, video)
  submittedPostLinks?: string[]; // 🔧 新增：支持多个推文链接 - Multiple links (tweets, videos, etc.)
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

// 提现记录
export interface WithdrawalRequest {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateTaskId: string;        // 关联的任务ID
  taskTitle: string;              // 任务标题
  amount: number;                 // 提现金额
  paymentMethod: string;          // 收款方式 (PayPal, Bank Transfer, Crypto, etc.)
  paymentDetails: string;         // 收款详情 (账号、地址等)
  status: WithdrawalStatus;       // 提现状态
  requestedAt: string;            // 提交时间
  processedAt?: string;           // 处理时间
  completedAt?: string;           // 完成时间
  paymentProof?: string;          // 付款截图URL
  adminNotes?: string;            // 运营备注
}

// 达人等级对应的奖励金额（美元/千次点击）
export const TIER_RATES = {
  [Tier.CORE_PARTNER]: 50,           // 基础合作伙伴: $50/1000次点击
  [Tier.PREMIUM_INFLUENCER]: 80,     // 高级影响者: $80/1000次点击
  [Tier.OFFICIAL_COLLABORATOR]: 100  // 官方合作者: $100/1000次点击
};

// 达人等级的中英文显示名称
export const TIER_LABELS = {
  [Tier.CORE_PARTNER]: { zh: '基础合作伙伴', en: 'Core Partner' },
  [Tier.PREMIUM_INFLUENCER]: { zh: '高级影响者', en: 'Premium Influencer' },
  [Tier.OFFICIAL_COLLABORATOR]: { zh: '官方合作者', en: 'Official Collaborator' }
};

// 通知类型
export enum NotificationType {
  WITHDRAWAL_SUBMITTED = 'WITHDRAWAL_SUBMITTED',     // 提现申请已提交
  WITHDRAWAL_PROCESSING = 'WITHDRAWAL_PROCESSING',   // 提现处理中
  WITHDRAWAL_COMPLETED = 'WITHDRAWAL_COMPLETED',     // 提现已完成
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',       // 提现被拒绝
  TASK_ASSIGNED = 'TASK_ASSIGNED',                   // 新任务分配
  TASK_VERIFIED = 'TASK_VERIFIED',                   // 任务审核通过
  TIER_UPGRADED = 'TIER_UPGRADED'                    // 等级提升
}

// 通知接口
export interface Notification {
  id: string;
  userId: string;                    // 接收通知的用户ID
  type: NotificationType;            // 通知类型
  title: string;                     // 通知标题
  message: string;                   // 通知内容
  relatedId?: string;                // 相关对象ID（如提现ID、任务ID）
  isRead: boolean;                   // 是否已读
  createdAt: string;                 // 创建时间
  data?: any;                        // 额外数据（如金额、付款截图链接等）
}
