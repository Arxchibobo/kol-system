import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db: SqlJsDatabase | null = null;

// 使用项目根目录的 data 文件夹存储数据库（持久化存储）
// 生产环境可以通过环境变量 DB_PATH 自定义路径
const dataDir = process.env.DB_PATH || path.join(process.cwd(), 'data');
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
                social_links TEXT,
                total_earnings REAL DEFAULT 0,
                pending_earnings REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. 任务表 (存储运营后台创建的所有任务)
        db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                product_link TEXT,
                is_special_reward INTEGER DEFAULT 0,
                special_rewards TEXT,
                status TEXT DEFAULT 'ACTIVE',
                deadline TEXT,
                requirements TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);

        // 5. 提现记录表
        db.run(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id TEXT PRIMARY KEY,
                affiliate_id TEXT NOT NULL,
                affiliate_name TEXT NOT NULL,
                affiliate_task_id TEXT NOT NULL,
                task_title TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT NOT NULL,
                payment_details TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                completed_at DATETIME,
                payment_proof TEXT,
                admin_notes TEXT
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate ON withdrawal_requests(affiliate_id);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);`);

        // 6. 通知表
        db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                related_id TEXT,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                data TEXT
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);`);

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
 * 获取指定达人和任务的点击统计
 * @param creatorId - 达人用户 ID
 * @param taskId - 任务 ID
 * @returns 包含总点击数、有效点击数等信息
 */
export async function getStatsByCreatorAndTask(creatorId: string, taskId: string) {
    const database = await initDB();

    try {
        // 查询该达人该任务的所有链接的点击总数
        const result = database.exec(
            `SELECT SUM(click_count) as total_clicks, COUNT(*) as link_count
             FROM links
             WHERE creator_user_id = ? AND task_id = ?`,
            [creatorId, taskId]
        );

        if (result.length === 0 || result[0].values.length === 0) {
            return {
                totalClicks: 0,
                validClicks: 0,
                linkCount: 0
            };
        }

        const totalClicks = result[0].values[0][0] || 0;
        const linkCount = result[0].values[0][1] || 0;

        // 假设所有点击都是有效点击（可以根据需求添加过滤逻辑）
        const validClicks = totalClicks;

        console.log(`[DB] 达人 ${creatorId} 任务 ${taskId} 统计: ${totalClicks} 次点击, ${linkCount} 个链接`);

        return {
            totalClicks: Number(totalClicks),
            validClicks: Number(validClicks),
            linkCount: Number(linkCount)
        };
    } catch (error) {
        console.error('[DB] 获取点击统计失败:', error);
        return {
            totalClicks: 0,
            validClicks: 0,
            linkCount: 0
        };
    }
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
    socialLinks?: any;
    totalEarnings?: number;
    pendingEarnings?: number;
}) {
    const database = await initDB();

    // 检查用户是否存在
    const existingUser = database.exec(`SELECT id FROM users WHERE id = ?`, [userId]);

    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
    const socialLinksJson = data.socialLinks ? JSON.stringify(data.socialLinks) : null;

    if (existingUser.length === 0 || existingUser[0].values.length === 0) {
        // 用户不存在,插入新记录（包含所有字段）
        database.run(
            `INSERT INTO users (id, name, email, follower_count, tags, avatar, tier, wallet_address, social_links, total_earnings, pending_earnings, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                userId,
                data.name || '',
                data.email || '',
                data.followerCount || 0,
                tagsJson,
                data.avatar || '',
                data.tier || 'BRONZE',
                data.walletAddress || '',
                socialLinksJson,
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
        if (data.socialLinks !== undefined) {
            updates.push('social_links = ?');
            values.push(socialLinksJson);
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

    // 解析 social_links JSON 并映射为 socialLinks (驼峰命名)
    if (row.social_links) {
        try {
            row.socialLinks = JSON.parse(row.social_links);
            delete row.social_links; // 删除下划线命名的字段
        } catch (e) {
            row.socialLinks = null;
        }
    }

    return row;
}

// ----------------------------------------------------------------------
// 删除任务（级联删除所有相关数据）
// ----------------------------------------------------------------------
export async function deleteTaskCascade(taskId: string): Promise<{
    clicksDeleted: number;
    linksDeleted: number;
    affiliateTasksDeleted: number;
    taskDeleted: boolean;
}> {
    if (!db) throw new Error("Database not initialized");

    const result = {
        clicksDeleted: 0,
        linksDeleted: 0,
        affiliateTasksDeleted: 0,
        taskDeleted: false
    };

    try {
        console.log(`[DB] 开始级联删除任务: ${taskId}`);

        // 1. 尝试删除追踪链接和点击记录（如果表存在）
        try {
            const linkIdsQuery = `SELECT id FROM tracking_links WHERE task_id = ?`;
            const linkRows = db.exec(linkIdsQuery, [taskId]);

            let linkIds: any[] = [];
            if (linkRows.length > 0 && linkRows[0].values.length > 0) {
                linkIds = linkRows[0].values.map(row => row[0]);
                console.log(`[DB] 找到 ${linkIds.length} 条追踪链接`);

                // 2. 删除这些链接的点击记录
                if (linkIds.length > 0) {
                    try {
                        // 先统计点击数
                        const clickCountQuery = `SELECT COUNT(*) FROM clicks WHERE link_id IN (${linkIds.map(() => '?').join(',')})`;
                        const clickCountResult = db.exec(clickCountQuery, linkIds);
                        if (clickCountResult.length > 0 && clickCountResult[0].values.length > 0) {
                            result.clicksDeleted = clickCountResult[0].values[0][0] as number;
                        }

                        // 删除点击记录
                        const deleteClicksQuery = `DELETE FROM clicks WHERE link_id IN (${linkIds.map(() => '?').join(',')})`;
                        db.run(deleteClicksQuery, linkIds);
                        console.log(`[DB] 删除了 ${result.clicksDeleted} 条点击记录`);
                    } catch (e) {
                        console.log(`[DB] clicks 表不存在或删除失败，跳过`);
                    }
                }

                // 3. 删除追踪链接
                const deleteLinksQuery = `DELETE FROM tracking_links WHERE task_id = ?`;
                db.run(deleteLinksQuery, [taskId]);
                result.linksDeleted = linkIds.length;
                console.log(`[DB] 删除了 ${result.linksDeleted} 条追踪链接`);
            } else {
                console.log(`[DB] 没有找到相关的追踪链接`);
            }
        } catch (e: any) {
            // tracking_links 表不存在，这是正常的（可能还没有创建追踪链接）
            if (e.message && e.message.includes('no such table')) {
                console.log(`[DB] tracking_links 表不存在，跳过删除追踪链接`);
            } else {
                throw e;
            }
        }

        // 4. 尝试删除达人任务记录（如果表存在）
        try {
            // 先统计数量
            const affTaskCountQuery = `SELECT COUNT(*) FROM affiliate_tasks WHERE task_id = ?`;
            const affTaskCountResult = db.exec(affTaskCountQuery, [taskId]);
            if (affTaskCountResult.length > 0 && affTaskCountResult[0].values.length > 0) {
                result.affiliateTasksDeleted = affTaskCountResult[0].values[0][0] as number;
            }

            // 删除达人任务记录
            const deleteAffTasksQuery = `DELETE FROM affiliate_tasks WHERE task_id = ?`;
            db.run(deleteAffTasksQuery, [taskId]);
            console.log(`[DB] 删除了 ${result.affiliateTasksDeleted} 条达人任务记录`);
        } catch (e: any) {
            // affiliate_tasks 表不存在
            if (e.message && e.message.includes('no such table')) {
                console.log(`[DB] affiliate_tasks 表不存在，跳过删除达人任务记录`);
            } else {
                throw e;
            }
        }

        // 5. 删除任务本身（tasks 表应该总是存在）
        const deleteTaskQuery = `DELETE FROM tasks WHERE id = ?`;
        db.run(deleteTaskQuery, [taskId]);
        result.taskDeleted = true;
        console.log(`[DB] 删除了任务: ${taskId}`);

        console.log(`[DB] 级联删除任务完成:`, result);
        return result;
    } catch (error) {
        console.error('[DB] 级联删除任务失败:', error);
        throw error;
    }
}

// 删除达人已领取的任务
// 注意：前端传递的 affiliateTaskId 格式为 "at-{timestamp}"
// 但后端数据库中没有直接对应的表，需要通过 uniqueTrackingLink 来识别
// 由于前端主要使用 localStorage 管理任务，后端只需要删除对应的 link 记录即可
export async function deleteAffiliateTask(affiliateTaskId: string): Promise<void> {
    const database = await initDB();
    try {
        console.log(`[DB] 删除达人任务: ${affiliateTaskId}`);

        // 前端的 affiliateTaskId 存储在 localStorage 中
        // 后端数据库中的 links 表没有直接关联
        // 实际上前端主要依赖 localStorage，后端删除可以是空操作
        // 但为了保持数据一致性，我们记录这个操作

        console.log(`[DB] ⚠️  注意: affiliateTaskId ${affiliateTaskId} 存储在前端 localStorage`);
        console.log(`[DB] 后端 links 表不需要删除操作，因为 link 可以继续存在`);
        console.log(`[DB] ✅ 达人任务删除请求已处理（前端会从 localStorage 移除）`);

        // 不需要保存，因为没有修改数据库
    } catch (error) {
        console.error('[DB] 删除达人任务失败:', error);
        throw error;
    }
}

// ----------------------------------------------------------------------
// 任务 CRUD 操作
// ----------------------------------------------------------------------

// 获取所有任务
export async function getAllTasks() {
    const database = await initDB();
    try {
        const result = database.exec(`SELECT * FROM tasks ORDER BY created_at DESC`);
        if (result.length === 0 || result[0].values.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        return result[0].values.map((row: any) => {
            const task: any = {};
            columns.forEach((col: string, index: number) => {
                task[col] = row[index];
            });

            // 字段名映射：数据库下划线命名 -> TypeScript 驼峰命名
            if (task.product_link !== undefined) {
                task.productLink = task.product_link;
                delete task.product_link;
            }
            if (task.is_special_reward !== undefined) {
                task.isSpecialReward = Boolean(task.is_special_reward);
                delete task.is_special_reward;
            }
            if (task.special_rewards !== undefined && task.special_rewards) {
                try {
                    task.specialRewards = JSON.parse(task.special_rewards);
                } catch (e) {
                    console.error('[DB] 解析 special_rewards 失败:', e);
                    task.specialRewards = null;
                }
                delete task.special_rewards;
            }
            if (task.created_at !== undefined) {
                task.createdAt = task.created_at;
                delete task.created_at;
            }
            if (task.updated_at !== undefined) {
                task.updatedAt = task.updated_at;
                delete task.updated_at;
            }

            // 将 requirements JSON 字符串解析为数组
            if (task.requirements) {
                try {
                    task.requirements = JSON.parse(task.requirements);
                } catch (e) {
                    console.error('[DB] 解析 requirements 失败:', e);
                    task.requirements = [];
                }
            } else {
                task.requirements = [];
            }

            return task;
        });
    } catch (error) {
        console.error('[DB] 获取任务失败:', error);
        return [];
    }
}

// 创建新任务
export async function createTask(taskData: any) {
    const database = await initDB();
    try {
        // 将 requirements 数组转为 JSON 字符串
        const requirementsJson = Array.isArray(taskData.requirements)
            ? JSON.stringify(taskData.requirements)
            : (taskData.requirements || '[]');

        // 将 specialRewards 对象转为 JSON 字符串
        const specialRewardsJson = taskData.specialRewards
            ? JSON.stringify(taskData.specialRewards)
            : null;

        database.run(
            `INSERT INTO tasks (id, title, description, product_link, is_special_reward, special_rewards, status, deadline, requirements, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                taskData.id,
                taskData.title,
                taskData.description || '',
                taskData.productLink || '',
                taskData.isSpecialReward ? 1 : 0,
                specialRewardsJson,
                taskData.status || 'ACTIVE',
                taskData.deadline || null,
                requirementsJson
            ]
        );
        saveDB();
        console.log(`[DB] 任务创建成功: ${taskData.id}`);
        return { success: true, id: taskData.id };
    } catch (error) {
        console.error('[DB] 创建任务失败:', error);
        throw error;
    }
}

// 更新任务
export async function updateTask(taskId: string, taskData: any) {
    const database = await initDB();
    try {
        // 将 requirements 数组转为 JSON 字符串
        const requirementsJson = Array.isArray(taskData.requirements)
            ? JSON.stringify(taskData.requirements)
            : (taskData.requirements || '[]');

        // 将 specialRewards 对象转为 JSON 字符串
        const specialRewardsJson = taskData.specialRewards
            ? JSON.stringify(taskData.specialRewards)
            : null;

        database.run(
            `UPDATE tasks
             SET title = ?, description = ?, product_link = ?, is_special_reward = ?, special_rewards = ?,
                 status = ?, deadline = ?, requirements = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                taskData.title,
                taskData.description || '',
                taskData.productLink || '',
                taskData.isSpecialReward ? 1 : 0,
                specialRewardsJson,
                taskData.status || 'ACTIVE',
                taskData.deadline || null,
                requirementsJson,
                taskId
            ]
        );
        saveDB();
        console.log(`[DB] 任务更新成功: ${taskId}`);
        return { success: true, id: taskId };
    } catch (error) {
        console.error('[DB] 更新任务失败:', error);
        throw error;
    }
}

// 根据 ID 获取单个任务
export async function getTaskById(taskId: string) {
    const database = await initDB();
    try {
        const result = database.exec(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
        if (result.length === 0 || result[0].values.length === 0) {
            return null;
        }

        const columns = result[0].columns;
        const row = result[0].values[0];
        const task: any = {};
        columns.forEach((col: string, index: number) => {
            task[col] = row[index];
        });

        // 字段名映射：数据库下划线命名 -> TypeScript 驼峰命名
        if (task.product_link !== undefined) {
            task.productLink = task.product_link;
            delete task.product_link;
        }
        if (task.is_special_reward !== undefined) {
            task.isSpecialReward = Boolean(task.is_special_reward);
            delete task.is_special_reward;
        }
        if (task.special_rewards !== undefined && task.special_rewards) {
            try {
                task.specialRewards = JSON.parse(task.special_rewards);
            } catch (e) {
                console.error('[DB] 解析 special_rewards 失败:', e);
                task.specialRewards = null;
            }
            delete task.special_rewards;
        }
        if (task.created_at !== undefined) {
            task.createdAt = task.created_at;
            delete task.created_at;
        }
        if (task.updated_at !== undefined) {
            task.updatedAt = task.updated_at;
            delete task.updated_at;
        }

        // 将 requirements JSON 字符串解析为数组
        if (task.requirements) {
            try {
                task.requirements = JSON.parse(task.requirements);
            } catch (e) {
                console.error('[DB] 解析 requirements 失败:', e);
                task.requirements = [];
            }
        } else {
            task.requirements = [];
        }

        return task;
    } catch (error) {
        console.error('[DB] 获取任务失败:', error);
        return null;
    }
}

// 获取任务的参与达人列表
export async function getTaskParticipants(taskId: string) {
    const database = await initDB();
    try {
        const result = database.exec(`
            SELECT
                at.id as affiliate_task_id,
                at.affiliate_id,
                u.name as affiliate_name,
                u.email as affiliate_email,
                u.tier as affiliate_tier,
                at.status,
                at.claimed_at,
                COUNT(c.id) as total_clicks
            FROM affiliate_tasks at
            LEFT JOIN users u ON at.affiliate_id = u.id
            LEFT JOIN clicks c ON at.id = c.affiliate_task_id
            WHERE at.task_id = ?
            GROUP BY at.id
            ORDER BY at.claimed_at DESC
        `, [taskId]);

        if (result.length === 0 || result[0].values.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        return result[0].values.map((row: any) => {
            const participant: any = {};
            columns.forEach((col: string, index: number) => {
                // 字段名映射：下划线命名 -> 驼峰命名
                const camelCol = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                participant[camelCol] = row[index];
            });
            return participant;
        });
    } catch (error) {
        console.error('[DB] 获取任务参与者失败:', error);
        return [];
    }
}

// ----------------------------------------------------------------------
// 提现记录 CRUD 操作
// ----------------------------------------------------------------------

// 创建提现请求
export async function createWithdrawalRequest(data: any) {
    const database = await initDB();
    try {
        database.run(
            `INSERT INTO withdrawal_requests
             (id, affiliate_id, affiliate_name, affiliate_task_id, task_title, amount,
              payment_method, payment_details, status, requested_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                data.id,
                data.affiliateId,
                data.affiliateName,
                data.affiliateTaskId,
                data.taskTitle,
                data.amount,
                data.paymentMethod,
                data.paymentDetails,
                'PENDING'
            ]
        );
        saveDB();
        console.log(`[DB] 提现请求创建成功: ${data.id}`);
        return { success: true, id: data.id };
    } catch (error) {
        console.error('[DB] 创建提现请求失败:', error);
        throw error;
    }
}

// 获取所有提现请求
export async function getAllWithdrawalRequests() {
    const database = await initDB();
    try {
        const result = database.exec(
            `SELECT * FROM withdrawal_requests ORDER BY requested_at DESC`
        );
        if (result.length === 0 || result[0].values.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        return result[0].values.map((row: any) => {
            const withdrawal: any = {};
            columns.forEach((col: string, index: number) => {
                withdrawal[col] = row[index];
            });

            // 字段名映射
            if (withdrawal.affiliate_id !== undefined) {
                withdrawal.affiliateId = withdrawal.affiliate_id;
                delete withdrawal.affiliate_id;
            }
            if (withdrawal.affiliate_name !== undefined) {
                withdrawal.affiliateName = withdrawal.affiliate_name;
                delete withdrawal.affiliate_name;
            }
            if (withdrawal.affiliate_task_id !== undefined) {
                withdrawal.affiliateTaskId = withdrawal.affiliate_task_id;
                delete withdrawal.affiliate_task_id;
            }
            if (withdrawal.task_title !== undefined) {
                withdrawal.taskTitle = withdrawal.task_title;
                delete withdrawal.task_title;
            }
            if (withdrawal.payment_method !== undefined) {
                withdrawal.paymentMethod = withdrawal.payment_method;
                delete withdrawal.payment_method;
            }
            if (withdrawal.payment_details !== undefined) {
                withdrawal.paymentDetails = withdrawal.payment_details;
                delete withdrawal.payment_details;
            }
            if (withdrawal.requested_at !== undefined) {
                withdrawal.requestedAt = withdrawal.requested_at;
                delete withdrawal.requested_at;
            }
            if (withdrawal.processed_at !== undefined) {
                withdrawal.processedAt = withdrawal.processed_at;
                delete withdrawal.processed_at;
            }
            if (withdrawal.completed_at !== undefined) {
                withdrawal.completedAt = withdrawal.completed_at;
                delete withdrawal.completed_at;
            }
            if (withdrawal.payment_proof !== undefined) {
                withdrawal.paymentProof = withdrawal.payment_proof;
                delete withdrawal.payment_proof;
            }
            if (withdrawal.admin_notes !== undefined) {
                withdrawal.adminNotes = withdrawal.admin_notes;
                delete withdrawal.admin_notes;
            }

            return withdrawal;
        });
    } catch (error) {
        console.error('[DB] 获取提现请求失败:', error);
        return [];
    }
}

// 获取达人的提现请求
export async function getWithdrawalRequestsByAffiliate(affiliateId: string) {
    const database = await initDB();
    try {
        const result = database.exec(
            `SELECT * FROM withdrawal_requests WHERE affiliate_id = ? ORDER BY requested_at DESC`,
            [affiliateId]
        );

        if (result.length === 0 || result[0].values.length === 0) {
            return [];
        }

        // 使用相同的映射逻辑
        const columns = result[0].columns;
        return result[0].values.map((row: any) => {
            const withdrawal: any = {};
            columns.forEach((col: string, index: number) => {
                withdrawal[col] = row[index];
            });

            // 字段名映射（与 getAllWithdrawalRequests 相同）
            if (withdrawal.affiliate_id !== undefined) {
                withdrawal.affiliateId = withdrawal.affiliate_id;
                delete withdrawal.affiliate_id;
            }
            if (withdrawal.affiliate_name !== undefined) {
                withdrawal.affiliateName = withdrawal.affiliate_name;
                delete withdrawal.affiliate_name;
            }
            if (withdrawal.affiliate_task_id !== undefined) {
                withdrawal.affiliateTaskId = withdrawal.affiliate_task_id;
                delete withdrawal.affiliate_task_id;
            }
            if (withdrawal.task_title !== undefined) {
                withdrawal.taskTitle = withdrawal.task_title;
                delete withdrawal.task_title;
            }
            if (withdrawal.payment_method !== undefined) {
                withdrawal.paymentMethod = withdrawal.payment_method;
                delete withdrawal.payment_method;
            }
            if (withdrawal.payment_details !== undefined) {
                withdrawal.paymentDetails = withdrawal.payment_details;
                delete withdrawal.payment_details;
            }
            if (withdrawal.requested_at !== undefined) {
                withdrawal.requestedAt = withdrawal.requested_at;
                delete withdrawal.requested_at;
            }
            if (withdrawal.processed_at !== undefined) {
                withdrawal.processedAt = withdrawal.processed_at;
                delete withdrawal.processed_at;
            }
            if (withdrawal.completed_at !== undefined) {
                withdrawal.completedAt = withdrawal.completed_at;
                delete withdrawal.completed_at;
            }
            if (withdrawal.payment_proof !== undefined) {
                withdrawal.paymentProof = withdrawal.payment_proof;
                delete withdrawal.payment_proof;
            }
            if (withdrawal.admin_notes !== undefined) {
                withdrawal.adminNotes = withdrawal.admin_notes;
                delete withdrawal.admin_notes;
            }

            return withdrawal;
        });
    } catch (error) {
        console.error('[DB] 获取达人提现请求失败:', error);
        return [];
    }
}

// 更新提现请求状态
export async function updateWithdrawalStatus(
    withdrawalId: string,
    status: string,
    paymentProof?: string,
    adminNotes?: string
) {
    const database = await initDB();
    try {
        const updates: string[] = [];
        const values: any[] = [];

        updates.push('status = ?');
        values.push(status);

        if (status === 'PROCESSING') {
            updates.push('processed_at = CURRENT_TIMESTAMP');
        }

        if (status === 'COMPLETED') {
            updates.push('completed_at = CURRENT_TIMESTAMP');
        }

        if (paymentProof) {
            updates.push('payment_proof = ?');
            values.push(paymentProof);
        }

        if (adminNotes) {
            updates.push('admin_notes = ?');
            values.push(adminNotes);
        }

        values.push(withdrawalId);

        database.run(
            `UPDATE withdrawal_requests SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        saveDB();
        console.log(`[DB] 提现请求状态更新成功: ${withdrawalId} -> ${status}`);
        return { success: true, id: withdrawalId };
    } catch (error) {
        console.error('[DB] 更新提现请求状态失败:', error);
        throw error;
    }
}

// ----------------------------------------------------------------------
// 通知 CRUD 操作
// ----------------------------------------------------------------------

// 创建通知
export async function createNotification(notificationData: any) {
    const database = await initDB();
    try {
        const dataJson = notificationData.data ? JSON.stringify(notificationData.data) : null;

        database.run(
            `INSERT INTO notifications (id, user_id, type, title, message, related_id, is_read, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                notificationData.id,
                notificationData.userId,
                notificationData.type,
                notificationData.title,
                notificationData.message,
                notificationData.relatedId || null,
                notificationData.isRead ? 1 : 0,
                dataJson
            ]
        );
        saveDB();
        console.log(`[DB] 通知创建成功: ${notificationData.id}`);
        return { success: true, id: notificationData.id };
    } catch (error) {
        console.error('[DB] 创建通知失败:', error);
        throw error;
    }
}

// 获取用户的所有通知
export async function getNotificationsByUser(userId: string) {
    const database = await initDB();
    try {
        const result = database.exec(
            `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        if (result.length === 0 || result[0].values.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        return result[0].values.map((row: any) => {
            const notification: any = {};
            columns.forEach((col: string, index: number) => {
                notification[col] = row[index];
            });

            // 字段名映射
            if (notification.user_id !== undefined) {
                notification.userId = notification.user_id;
                delete notification.user_id;
            }
            if (notification.related_id !== undefined) {
                notification.relatedId = notification.related_id;
                delete notification.related_id;
            }
            if (notification.is_read !== undefined) {
                notification.isRead = Boolean(notification.is_read);
                delete notification.is_read;
            }
            if (notification.created_at !== undefined) {
                notification.createdAt = notification.created_at;
                delete notification.created_at;
            }

            // 解析 data JSON
            if (notification.data) {
                try {
                    notification.data = JSON.parse(notification.data);
                } catch (e) {
                    console.error('[DB] 解析通知 data 失败:', e);
                    notification.data = null;
                }
            }

            return notification;
        });
    } catch (error) {
        console.error('[DB] 获取用户通知失败:', error);
        return [];
    }
}

// 标记通知为已读
export async function markNotificationAsRead(notificationId: string) {
    const database = await initDB();
    try {
        database.run(
            `UPDATE notifications SET is_read = 1 WHERE id = ?`,
            [notificationId]
        );
        saveDB();
        console.log(`[DB] 通知标记为已读: ${notificationId}`);
        return { success: true };
    } catch (error) {
        console.error('[DB] 标记通知已读失败:', error);
        throw error;
    }
}

// 标记所有通知为已读
export async function markAllNotificationsAsRead(userId: string) {
    const database = await initDB();
    try {
        database.run(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        saveDB();
        console.log(`[DB] 用户 ${userId} 的所有通知已标记为已读`);
        return { success: true };
    } catch (error) {
        console.error('[DB] 标记所有通知已读失败:', error);
        throw error;
    }
}

// 获取未读通知数量
export async function getUnreadNotificationCount(userId: string): Promise<number> {
    const database = await initDB();
    try {
        const result = database.exec(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
            [userId]
        );

        if (result.length === 0 || result[0].values.length === 0) {
            return 0;
        }

        return Number(result[0].values[0][0]) || 0;
    } catch (error) {
        console.error('[DB] 获取未读通知数量失败:', error);
        return 0;
    }
}
