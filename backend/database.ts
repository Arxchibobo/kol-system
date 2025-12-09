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
