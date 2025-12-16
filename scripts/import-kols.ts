import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { User, UserRole, Tier } from '../types';

// CSV 文件路径
const CSV_FILE_1 = path.join(__dirname, '../KOL_Export_2025-12-16.csv');
const CSV_FILE_2 = path.join(__dirname, '../博主合作数据库 2933f81ff51e808cbc21e9c140005179.csv');

interface KOLData {
  name: string;
  email: string;
  handle: string;
  platform: string;
  tier: Tier;
  followerCount: number;
  tags: string[];
  socialLinks: any;
}

// Tier 映射
const tierMapping: Record<string, Tier> = {
  'Mega': Tier.GOLD,
  'Top': Tier.SILVER,
  'Mid': Tier.BRONZE,
  'Micro': Tier.BRONZE,
};

// 解析粉丝数
function parseFollowerCount(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === 'N/A') return 0;

  const cleanValue = String(value).replace(/,/g, '').trim();
  const multiplier = cleanValue.match(/[KkMm]$/);

  if (multiplier) {
    const num = parseFloat(cleanValue);
    if (multiplier[0].toLowerCase() === 'k') return Math.floor(num * 1000);
    if (multiplier[0].toLowerCase() === 'm') return Math.floor(num * 1000000);
  }

  return parseInt(cleanValue, 10) || 0;
}

// 从 URL 提取 handle
function extractHandle(url: string): string {
  if (!url) return '';

  // 移除多余的空格和换行
  url = url.trim().replace(/\s+/g, '');

  // 提取 Instagram handle
  const instagramMatch = url.match(/instagram\.com\/([^\/\?]+)/);
  if (instagramMatch) return instagramMatch[1];

  // 提取 Twitter/X handle
  const twitterMatch = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
  if (twitterMatch) return twitterMatch[1];

  // 提取 TikTok handle
  const tiktokMatch = url.match(/tiktok\.com\/@?([^\/\?]+)/);
  if (tiktokMatch) return tiktokMatch[1];

  // 提取 YouTube handle
  const youtubeMatch = url.match(/youtube\.com\/@?([^\/\?]+)/);
  if (youtubeMatch) return youtubeMatch[1];

  return '';
}

// 从 URL 判断平台
function getPlatformFromUrl(url: string): string {
  if (!url) return 'Instagram';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('youtube.com')) return 'YouTube';
  return 'Instagram';
}

// 生成社交媒体链接
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

// 解析第一个 CSV（KOL_Export_2025-12-16.csv）
async function parseFirstCSV(): Promise<KOLData[]> {
  return new Promise((resolve, reject) => {
    const results: KOLData[] = [];

    fs.readFile(CSV_FILE_1, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      Papa.parse(data, {
        header: true,
        skipEmptyLines: true,
        complete: (parseResult) => {
          parseResult.data.forEach((row: any) => {
            if (!row.Name || !row.Handle) return;

            const email = (row.Email && row.Email !== 'N/A') ? row.Email.trim() : 'N/A';
            const tier = tierMapping[row.Tier] || Tier.BRONZE;
            const followerCount = parseFollowerCount(row.Followers);

            // 标签映射
            const tags: string[] = [];
            const category = row.Category || '';

            if (category.includes('Fashion & Beauty')) tags.push('时尚博主');
            if (category.includes('Tech & AI')) tags.push('科技博主', 'AI博主');
            if (category.includes('Education & Career')) tags.push('其他');
            if (category.includes('Travel & Food')) tags.push('美食博主', '旅游博主');
            if (category.includes('Gaming & Ent.')) tags.push('游戏博主');
            if (category.includes('Lifestyle & Family')) tags.push('生活博主');
            if (category.includes('General')) tags.push('其他');

            // 生成社交媒体链接
            const platform = row.Platform || 'Instagram';
            const handle = row.Handle.replace('@', '').trim();
            const socialLinks: any = {};

            const link = generateSocialLink(platform, handle);
            if (platform.toLowerCase() === 'instagram') socialLinks.instagram = link;
            else if (platform.toLowerCase() === 'twitter' || platform.toLowerCase() === 'x') socialLinks.twitter = link;
            else if (platform.toLowerCase() === 'youtube') socialLinks.youtube = link;
            else if (platform.toLowerCase() === 'tiktok') socialLinks.tiktok = link;

            results.push({
              name: row.Name.trim(),
              email,
              handle,
              platform,
              tier,
              followerCount,
              tags: [...new Set(tags)],
              socialLinks
            });
          });

          resolve(results);
        },
        error: reject
      });
    });
  });
}

// 解析第二个 CSV（博主合作数据库）
async function parseSecondCSV(): Promise<KOLData[]> {
  return new Promise((resolve, reject) => {
    const results: KOLData[] = [];

    fs.readFile(CSV_FILE_2, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      Papa.parse(data, {
        header: true,
        skipEmptyLines: true,
        complete: (parseResult) => {
          parseResult.data.forEach((row: any) => {
            const url = row['博主'] || '';
            if (!url || url.includes('http') === false) return;

            // 提取第一个有效的 URL
            const urls = url.split('https://').filter(Boolean);
            const firstUrl = urls.length > 0 ? 'https://' + urls[0].trim() : '';
            if (!firstUrl) return;

            const handle = extractHandle(firstUrl);
            if (!handle) return;

            const platform = getPlatformFromUrl(firstUrl);
            const followerCount = parseFollowerCount(row['粉丝总量'] || 0);

            // 根据粉丝数判断 Tier
            let tier = Tier.BRONZE;
            if (followerCount >= 1000000) tier = Tier.GOLD;
            else if (followerCount >= 500000) tier = Tier.SILVER;

            // 解析标签
            const tags: string[] = [];
            const profile = row['博主画像'] || '';

            if (profile.includes('宝妈博主')) tags.push('生活博主');
            if (profile.includes('时尚博主')) tags.push('时尚博主');
            if (profile.includes('生活博主')) tags.push('生活博主');
            if (profile.includes('美妆博主')) tags.push('时尚博主');
            if (profile.includes('设计师博主')) tags.push('其他');
            if (profile.includes('Ai圈核心艺术家') || profile.includes('过往AI艺术家')) tags.push('AI博主', '科技博主');
            if (profile.includes('国际学生')) tags.push('其他');
            if (profile.includes('海外主流媒体')) tags.push('其他');

            // 生成社交媒体链接
            const socialLinks: any = {};
            if (platform === 'Instagram') socialLinks.instagram = firstUrl;
            else if (platform === 'Twitter') socialLinks.twitter = firstUrl;
            else if (platform === 'TikTok') socialLinks.tiktok = firstUrl;
            else if (platform === 'YouTube') socialLinks.youtube = firstUrl;

            // 生成名称
            const name = handle.charAt(0).toUpperCase() + handle.slice(1);

            results.push({
              name,
              email: 'N/A',
              handle,
              platform,
              tier,
              followerCount,
              tags: [...new Set(tags)],
              socialLinks
            });
          });

          resolve(results);
        },
        error: reject
      });
    });
  });
}

// 去重逻辑
function deduplicateKOLs(kols: KOLData[]): KOLData[] {
  const seen = new Set<string>();
  const deduplicated: KOLData[] = [];

  kols.forEach(kol => {
    // 使用 handle 作为唯一标识
    const key = kol.handle.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(kol);
    }
  });

  return deduplicated;
}

// 转换为 User 对象
function convertToUsers(kols: KOLData[]): Partial<User>[] {
  return kols.map(kol => ({
    name: kol.name,
    email: kol.email === 'N/A' ? '' : kol.email,
    role: UserRole.AFFILIATE,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(kol.name)}&background=random&color=fff&bold=true`,
    tier: kol.tier,
    followerCount: kol.followerCount,
    totalEarnings: 0,
    pendingEarnings: 0,
    totalClicks: 0,
    validClicks: 0,
    socialLinks: kol.socialLinks,
    tags: kol.tags,
    notificationSettings: {
      newTaskAlert: true
    }
  }));
}

// 主函数
async function main() {
  try {
    console.log('📊 开始解析 CSV 文件...');

    const kols1 = await parseFirstCSV();
    console.log(`✅ 第一个文件解析完成: ${kols1.length} 个 KOL`);

    const kols2 = await parseSecondCSV();
    console.log(`✅ 第二个文件解析完成: ${kols2.length} 个 KOL`);

    // 合并并去重
    const allKOLs = [...kols1, ...kols2];
    const deduplicatedKOLs = deduplicateKOLs(allKOLs);
    console.log(`🔄 去重后: ${deduplicatedKOLs.length} 个唯一 KOL`);

    // 转换为 User 对象
    const users = convertToUsers(deduplicatedKOLs);

    // 输出 JSON 供前端使用
    const outputPath = path.join(__dirname, '../kol-import-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(users, null, 2), 'utf8');
    console.log(`✅ 数据已保存到: ${outputPath}`);

    // 统计信息
    const tierStats = {
      gold: users.filter(u => u.tier === Tier.GOLD).length,
      silver: users.filter(u => u.tier === Tier.SILVER).length,
      bronze: users.filter(u => u.tier === Tier.BRONZE).length,
    };

    console.log('\n📈 统计信息:');
    console.log(`  总数: ${users.length}`);
    console.log(`  GOLD: ${tierStats.gold}`);
    console.log(`  SILVER: ${tierStats.silver}`);
    console.log(`  BRONZE: ${tierStats.bronze}`);
    console.log(`  有邮箱: ${users.filter(u => u.email).length}`);
    console.log(`  无邮箱: ${users.filter(u => !u.email).length}`);

    console.log('\n✅ 导入准备完成！');
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

main();
