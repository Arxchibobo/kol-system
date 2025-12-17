import Papa from 'papaparse';
import { User, UserRole, Tier } from '../types';

// CSV 行的数据结构
interface CSVRow {
  Name: string;
  Handle: string;
  Platform: string;
  Tier: string;
  Followers: string;
  Category: string;
  Email: string;
  'Avg Views': string;
  'Engagement Rate': string;
  Region: string;
  Tags: string;
}

// 导入结果统计
export interface ImportResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  errors: string[];
  users: Partial<User>[];
}

// Tier 映射：CSV 的等级映射到系统等级
const tierMapping: Record<string, Tier> = {
  'Mega': Tier.OFFICIAL_COLLABORATOR,
  'Top': Tier.PREMIUM_INFLUENCER,
  'Mid': Tier.CORE_PARTNER,
  'Micro': Tier.CORE_PARTNER,
};

// Category 映射：CSV 的分类映射到系统标签
const categoryMapping: Record<string, string[]> = {
  'Fashion & Beauty': ['时尚博主'],
  'Tech & AI': ['科技博主', 'AI博主'],
  'Education & Career': ['其他'],
  'Travel & Food': ['美食博主', '旅游博主'],
  'Gaming & Ent.': ['游戏博主'],
  'Lifestyle & Family': ['生活博主'],
  'General': ['其他'],
};

// 解析粉丝数（支持 K, M 等单位）
function parseFollowerCount(value: string): number {
  if (!value || value === 'N/A') return 0;

  const cleanValue = value.replace(/,/g, '').trim();
  const multiplier = cleanValue.match(/[KkMm]$/);

  if (multiplier) {
    const num = parseFloat(cleanValue);
    if (multiplier[0].toLowerCase() === 'k') return Math.floor(num * 1000);
    if (multiplier[0].toLowerCase() === 'm') return Math.floor(num * 1000000);
  }

  return parseInt(cleanValue, 10) || 0;
}

// 根据平台生成社交媒体链接
function generateSocialLink(platform: string, handle: string): string {
  if (!handle || handle === 'N/A') return '';

  const cleanHandle = handle.replace('@', '').trim();

  switch (platform.toLowerCase()) {
    case 'instagram':
      return `https://instagram.com/${cleanHandle}`;
    case 'twitter':
    case 'x':
      return `https://twitter.com/${cleanHandle}`;
    case 'youtube':
      return `https://youtube.com/@${cleanHandle}`;
    case 'tiktok':
      return `https://tiktok.com/@${cleanHandle}`;
    default:
      return cleanHandle;
  }
}

// 转换单个 CSV 行到 User 对象
function convertRowToUser(row: CSVRow, index: number): { user: Partial<User> | null; error?: string } {
  // 验证必填字段
  if (!row.Name || !row.Platform || !row.Handle) {
    return {
      user: null,
      error: `第 ${index + 2} 行：缺少必填字段 (Name/Platform/Handle)`
    };
  }

  // Email 处理：如果是 "N/A" 或空，则留空
  const email = (row.Email && row.Email !== 'N/A') ? row.Email.trim() : '';

  // 获取 Tier
  const tier = tierMapping[row.Tier] || Tier.CORE_PARTNER;

  // 获取标签
  const tags: string[] = [];
  if (row.Category && categoryMapping[row.Category]) {
    tags.push(...categoryMapping[row.Category]);
  }

  // 添加额外的标签（如果 CSV 中有 Tags 列）
  if (row.Tags && row.Tags !== 'N/A') {
    const extraTags = row.Tags.split(',').map(t => t.trim()).filter(Boolean);
    tags.push(...extraTags);
  }

  // 粉丝数
  const followerCount = parseFollowerCount(row.Followers);

  // 生成社交媒体链接
  const socialLinks: any = {};
  const platform = row.Platform.toLowerCase();
  const link = generateSocialLink(row.Platform, row.Handle);

  if (platform === 'instagram') socialLinks.instagram = link;
  else if (platform === 'twitter' || platform === 'x') socialLinks.twitter = link;
  else if (platform === 'youtube') socialLinks.youtube = link;
  else if (platform === 'tiktok') socialLinks.tiktok = link;

  // 生成头像
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.Name)}&background=random&color=fff&bold=true`;

  const user: Partial<User> = {
    name: row.Name.trim(),
    email: email,
    role: UserRole.AFFILIATE,
    avatar,
    tier,
    followerCount,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalClicks: 0,
    validClicks: 0,
    socialLinks,
    tags: [...new Set(tags)], // 去重
    notificationSettings: {
      newTaskAlert: true
    }
  };

  return { user };
}

// 解析和验证 CSV 文件
export async function parseAndValidateCSV(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const result: ImportResult = {
      total: 0,
      success: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      users: []
    };

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        result.total = results.data.length;

        results.data.forEach((row, index) => {
          const { user, error } = convertRowToUser(row, index);

          if (error) {
            result.failed++;
            result.errors.push(error);
          } else if (user) {
            result.success++;
            result.users.push(user);
          }
        });

        resolve(result);
      },
      error: (error) => {
        result.failed = result.total;
        result.errors.push(`CSV 解析错误: ${error.message}`);
        resolve(result);
      }
    });
  });
}

// 生成导入预览数据（前 N 行）
export function generatePreviewData(users: Partial<User>[], limit: number = 10) {
  return users.slice(0, limit);
}

// 统计各个 Tier 的数量
export function getTierStats(users: Partial<User>[]) {
  return {
    official: users.filter(u => u.tier === Tier.OFFICIAL_COLLABORATOR).length,
    premium: users.filter(u => u.tier === Tier.PREMIUM_INFLUENCER).length,
    core: users.filter(u => u.tier === Tier.CORE_PARTNER).length,
  };
}

// 统计各个标签的数量
export function getTagStats(users: Partial<User>[]) {
  const tagCounts: Record<string, number> = {};
  users.forEach(user => {
    user.tags?.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  return tagCounts;
}
