import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db: SqlJsDatabase | null = null;

// 使用 /tmp 目录以获得读写权限 (适用于 Cloud Run)
const dataDir = os.tmpdir();
const dbPath = path.join(dataDir, 'tracking.sqlite');

// 确保数据目录存在 (对某些环境很重要)
try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
} catch (e) {
    console.error(`创建数据目录失败 ${dataDir}:`, e);
}

export async function initDB() {
    if (db) return db;

    console.log(`[DB] 初始化 SQLite 数据库: ${dbPath}`);

    try {
        const SQL = await initSqlJs();

        // 如果数据库文件存在，加载它
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            db = new SQL.Database(buffer);
        } else {
            db = new SQL.Database();
        }

        // 1. 链接表
        db.run(`
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                creator_user_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                campaign_id TEXT NOT NULL,
                target_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                click_count INTEGER DEFAULT 0
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_links_creator ON links(creator_user_id);`);

        // 2. 点击表
        db.run(`
            CREATE TABLE IF NOT EXISTS clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link_id INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                referrer TEXT,
                clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(link_id) REFERENCES links(id)
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);`);

        // 3. 用户资料表 (存储达人的完整信息)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                follower_count INTEGER DEFAULT 0,
                tags TEXT,
                avatar TEXT,
                tier TEXT,
                wallet_address TEXT,
                total_earnings REAL DEFAULT 0,
                pending_earnings REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 保存数据库到文件
        saveDB();

        console.log('✅ SQLite 数据表已就绪');
        return db;
    } catch (err) {
        console.error('❌ 数据库初始化失败:', err);
        throw err;
    }
}

// 保存数据库到文件
function saveDB() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

export async function createLink(data: {
    creator_user_id: string;
    task_id: string;
    campaign_id: string;
    target_url: string;
    code: string;
}) {
    const database = await initDB();
    database.run(
        `INSERT INTO links (code, creator_user_id, task_id, campaign_id, target_url) VALUES (?, ?, ?, ?, ?)`,
        [data.code, data.creator_user_id, data.task_id, data.campaign_id, data.target_url]
    );
    saveDB();
    return getLinkByCode(data.code);
}

export async function getLinkByCode(code: string) {
    const database = await initDB();
    const result = database.exec(`SELECT * FROM links WHERE code = ?`, [code]);
    if (result.length === 0 || result[0].values.length === 0) {
        return null;
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const row: any = {};
    columns.forEach((col, idx) => {
        row[col] = values[idx];
    });
    return row;
}

export async function logClick(linkId: number, ip: string, ua: string, referrer: string) {
    const database = await initDB();
    database.run(`INSERT INTO clicks (link_id, ip_address, user_agent, referrer) VALUES (?, ?, ?, ?)`, [linkId, ip, ua, referrer]);
    database.run(`UPDATE links SET click_count = click_count + 1 WHERE id = ?`, [linkId]);
    saveDB();
}

export async function getStatsByCreator(creatorId: string) {
    const database = await initDB();
    const result = database.exec(`SELECT SUM(click_count) as total_clicks FROM links WHERE creator_user_id = ?`, [creatorId]);

    if (result.length === 0 || result[0].values.length === 0) {
        return { totalClicks: 0 };
    }

    const totalClicks = result[0].values[0][0] || 0;
    return {
        totalClicks: totalClicks
    };
}

/**
 * 获取达人的详细统计信息 (用于运营侧显示)
 * @param creatorId - 达人用户 ID
 * @returns 包含 campaign 数量、点击数、短链接数等信息
 */
export async function getCreatorDetailedStats(creatorId: string) {
    const database = await initDB();

    // 1. 获取该达人参与的 campaign 数量 (通过 campaign_id 去重)
    const campaignResult = database.exec(
        `SELECT COUNT(DISTINCT campaign_id) as campaign_count FROM links WHERE creator_user_id = ?`,
        [creatorId]
    );

    // 2. 获取总点击数
    const clickResult = database.exec(
        `SELECT SUM(click_count) as total_clicks FROM links WHERE creator_user_id = ?`,
        [creatorId]
    );

    // 3. 获取短链接数量
    const linkResult = database.exec(
        `SELECT COUNT(*) as link_count FROM links WHERE creator_user_id = ?`,
        [creatorId]
    );

    // 4. 获取最近点击时间
    const recentClickResult = database.exec(
        `SELECT MAX(clicks.clicked_at) as last_click
         FROM clicks
         JOIN links ON clicks.link_id = links.id
         WHERE links.creator_user_id = ?`,
        [creatorId]
    );

    return {
        campaignsJoined: campaignResult[0]?.values[0]?.[0] || 0,
        totalClicks: clickResult[0]?.values[0]?.[0] || 0,
        linksCreated: linkResult[0]?.values[0]?.[0] || 0,
        lastClickAt: recentClickResult[0]?.values[0]?.[0] || null
    };
}

/**
 * 获取全局统计数据 (所有达人的汇总)
 */
export async function getAllTotalStats() {
    const database = await initDB();

    // 1. 总点击数
    const totalClicksResult = database.exec(`SELECT SUM(click_count) as total FROM links`);

    // 2. 总短链接数
    const totalLinksResult = database.exec(`SELECT COUNT(*) as total FROM links`);

    // 3. 总 campaign 数
    const totalCampaignsResult = database.exec(`SELECT COUNT(DISTINCT campaign_id) as total FROM links`);

    return {
        totalClicks: totalClicksResult[0]?.values[0]?.[0] || 0,
        totalLinks: totalLinksResult[0]?.values[0]?.[0] || 0,
        totalCampaigns: totalCampaignsResult[0]?.values[0]?.[0] || 0
    };
}

/**
 * 检测异常点击行为
 * 规则:
 * 1. 同一 IP 在 1 分钟内点击同一链接 > 5 次
 * 2. 同一 IP 在 1 小时内点击不同链接 > 20 次
 */
export async function detectAnomalies() {
    const database = await initDB();
    const anomalies: any[] = [];

    // 规则 1: 同一 IP 短时间内重复点击同一链接
    const rule1Result = database.exec(`
        SELECT
            clicks.ip_address,
            links.code,
            links.creator_user_id,
            COUNT(*) as click_count,
            MAX(clicks.clicked_at) as last_click
        FROM clicks
        JOIN links ON clicks.link_id = links.id
        WHERE clicks.clicked_at >= datetime('now', '-1 minute')
        GROUP BY clicks.ip_address, links.code
        HAVING click_count > 5
        ORDER BY click_count DESC
    `);

    if (rule1Result.length > 0 && rule1Result[0].values.length > 0) {
        rule1Result[0].values.forEach((row: any) => {
            anomalies.push({
                id: `anomaly-${Date.now()}-${Math.random()}`,
                type: 'high_frequency',
                linkCode: row[1],
                creatorId: row[2],
                ipAddress: row[0],
                clickCount: row[3],
                detectedAt: row[4],
                severity: row[3] > 10 ? 'high' : 'medium',
                details: `IP ${row[0]} 在 1 分钟内点击 ${row[3]} 次`
            });
        });
    }

    // 规则 2: 同一 IP 短时间内点击大量不同链接
    const rule2Result = database.exec(`
        SELECT
            clicks.ip_address,
            COUNT(DISTINCT links.code) as unique_links,
            MAX(clicks.clicked_at) as last_click
        FROM clicks
        JOIN links ON clicks.link_id = links.id
        WHERE clicks.clicked_at >= datetime('now', '-1 hour')
        GROUP BY clicks.ip_address
        HAVING unique_links > 20
        ORDER BY unique_links DESC
    `);

    if (rule2Result.length > 0 && rule2Result[0].values.length > 0) {
        rule2Result[0].values.forEach((row: any) => {
            anomalies.push({
                id: `anomaly-${Date.now()}-${Math.random()}`,
                type: 'suspicious_pattern',
                ipAddress: row[0],
                uniqueLinks: row[1],
                detectedAt: row[2],
                severity: row[1] > 50 ? 'high' : 'medium',
                details: `IP ${row[0]} 在 1 小时内点击了 ${row[1]} 个不同链接`
            });
        });
    }

    return anomalies;
}

/**
 * 更新用户资料（支持所有用户字段）
 */
export async function updateUserProfile(userId: string, data: {
    followerCount?: number;
    tags?: string[];
    name?: string;
    email?: string;
    avatar?: string;
    tier?: string;
    walletAddress?: string;
    totalEarnings?: number;
    pendingEarnings?: number;
}) {
    const database = await initDB();

    // 检查用户是否存在
    const existingUser = database.exec(`SELECT id FROM users WHERE id = ?`, [userId]);

    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;

    if (existingUser.length === 0 || existingUser[0].values.length === 0) {
        // 用户不存在,插入新记录（包含所有字段）
        database.run(
            `INSERT INTO users (id, name, email, follower_count, tags, avatar, tier, wallet_address, total_earnings, pending_earnings, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                userId,
                data.name || '',
                data.email || '',
                data.followerCount || 0,
                tagsJson,
                data.avatar || '',
                data.tier || 'BRONZE',
                data.walletAddress || '',
                data.totalEarnings || 0,
                data.pendingEarnings || 0
            ]
        );
    } else {
        // 用户存在,更新记录（支持所有字段）
        const updates: string[] = [];
        const values: any[] = [];

        if (data.followerCount !== undefined) {
            updates.push('follower_count = ?');
            values.push(data.followerCount);
        }
        if (data.tags !== undefined) {
            updates.push('tags = ?');
            values.push(tagsJson);
        }
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.email !== undefined) {
            updates.push('email = ?');
            values.push(data.email);
        }
        if (data.avatar !== undefined) {
            updates.push('avatar = ?');
            values.push(data.avatar);
        }
        if (data.tier !== undefined) {
            updates.push('tier = ?');
            values.push(data.tier);
        }
        if (data.walletAddress !== undefined) {
            updates.push('wallet_address = ?');
            values.push(data.walletAddress);
        }
        if (data.totalEarnings !== undefined) {
            updates.push('total_earnings = ?');
            values.push(data.totalEarnings);
        }
        if (data.pendingEarnings !== undefined) {
            updates.push('pending_earnings = ?');
            values.push(data.pendingEarnings);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);

        if (updates.length > 0) {
            database.run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
    }

    saveDB();
}

/**
 * 获取用户资料
 */
export async function getUserProfile(userId: string) {
    const database = await initDB();
    const result = database.exec(`SELECT * FROM users WHERE id = ?`, [userId]);

    if (result.length === 0 || result[0].values.length === 0) {
        return null;
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const row: any = {};
    columns.forEach((col, idx) => {
        row[col] = values[idx];
    });

    // 解析 tags JSON
    if (row.tags) {
        try {
            row.tags = JSON.parse(row.tags);
        } catch (e) {
            row.tags = [];
        }
    }

    return row;
}
