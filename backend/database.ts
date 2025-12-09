import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db: Database | null = null;

// Use /tmp for read-write access in Cloud Run
const dataDir = os.tmpdir();
const dbPath = path.join(dataDir, 'tracking.sqlite');

// Ensure dataDir exists (crucial for some environments)
try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
} catch (e) {
    console.error(`Failed to ensure data dir ${dataDir} exists:`, e);
}

export async function initDB() {
    if (db) return db;

    console.log(`[DB] Initializing SQLite at: ${dbPath}`);

    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // 1. Links Table
        await db.exec(`
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
            CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);
            CREATE INDEX IF NOT EXISTS idx_links_creator ON links(creator_user_id);
        `);

        // 2. Clicks Table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link_id INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                referrer TEXT,
                clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(link_id) REFERENCES links(id)
            );
            CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
        `);

        console.log('✅ SQLite Tables Ready');
        return db;
    } catch (err) {
        console.error('❌ DB Init Failed:', err);
        throw err;
    }
}

export async function createLink(data: {
    creator_user_id: string;
    task_id: string;
    campaign_id: string;
    target_url: string;
    code: string;
}) {
    const db = await initDB();
    await db.run(
        `INSERT INTO links (code, creator_user_id, task_id, campaign_id, target_url) VALUES (?, ?, ?, ?, ?)`,
        [data.code, data.creator_user_id, data.task_id, data.campaign_id, data.target_url]
    );
    return getLinkByCode(data.code);
}

export async function getLinkByCode(code: string) {
    const db = await initDB();
    return db.get(`SELECT * FROM links WHERE code = ?`, [code]);
}

export async function logClick(linkId: number, ip: string, ua: string, referrer: string) {
    const db = await initDB();
    await db.run(`INSERT INTO clicks (link_id, ip_address, user_agent, referrer) VALUES (?, ?, ?, ?)`, [linkId, ip, ua, referrer]);
    await db.run(`UPDATE links SET click_count = click_count + 1 WHERE id = ?`, [linkId]);
}

export async function getStatsByCreator(creatorId: string) {
    const db = await initDB();
    const result = await db.get(`SELECT SUM(click_count) as total_clicks FROM links WHERE creator_user_id = ?`, [creatorId]);
    return {
        totalClicks: result?.total_clicks || 0
    };
}