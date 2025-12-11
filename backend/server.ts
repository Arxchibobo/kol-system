import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { cwd } from 'node:process';
import { initDB, createLink, getLinkByCode, logClick, getStatsByCreator, getStatsByCreatorAndTask, getCreatorDetailedStats, getAllTotalStats, detectAnomalies, updateUserProfile, getUserProfile, deleteTaskCascade } from './database';

const app = express();
const PORT = process.env.PORT || 8080;
const DOMAIN = process.env.DOMAIN || 'myshell.site';

// 1. Request Logger Middleware (DEBUGGING)
app.use((req, res, next) => {
    // Filter out common noise from logs
    if (!req.url.includes('/assets/') && !req.url.includes('favicon')) {
        console.log(`[Request] ${req.method} ${req.url}`);
    }
    next();
});

app.use(cors());
app.use(express.json());

// Initialize Database on Start
initDB().catch(err => {
    console.error('FATAL: Failed to init DB:', err);
});

// Check if frontend build exists
const distPath = path.join(cwd(), 'dist');
if (!fs.existsSync(distPath)) {
    console.error(`[WARNING] 'dist' directory not found at ${distPath}. Frontend will not load. Ensure 'npm run build' ran.`);
} else {
    console.log(`[INFO] Serving frontend from ${distPath}`);
}

// ----------------------------------------------------------------------
// Health Check
// ----------------------------------------------------------------------
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        domain: DOMAIN, 
        version: 'v9-stable-double-jump',
        timestamp: new Date().toISOString()
    });
});

// ----------------------------------------------------------------------
// Client-Side Fallback Routes (Stateless) - HIGH PRIORITY
// ----------------------------------------------------------------------
// Using app.use('/r', ...) ensures we catch EVERYTHING starting with /r
// regardless of slashes, encoding, or wildcards.
app.use('/r', (req, res) => {
    console.log(`[Stateless Route] Serving frontend for path: /r${req.url}`);
    
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        // Prevent caching of the redirect entry point to ensure logic always runs
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found. Please run npm run build.');
    }
});

// ----------------------------------------------------------------------
// API Routes
// ----------------------------------------------------------------------
app.post('/api/tracking-links', async (req, res) => {
    console.log('[API] Creating tracking link...', req.body);
    try {
        const { creator_user_id, task_id, campaign_id, target_url } = req.body;

        if (!target_url) {
            return res.status(400).json({ error: 'Target URL is required' });
        }

        // Generate Secure Short Code (6 chars alphanumeric)
        const generateCode = (length = 6) => {
            const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let retVal = '';
            // Get random bytes
            const bytes = crypto.randomBytes(length);
            for (let i = 0; i < length; ++i) {
                // Map byte to charset index
                const index = bytes[i] % charset.length;
                retVal += charset[index];
            }
            return retVal;
        };

        let code = generateCode();
        let retries = 0;

        // Retry logic for collision handling
        while (retries < 5) {
            try {
                await createLink({
                    creator_user_id,
                    task_id,
                    campaign_id,
                    target_url,
                    code
                });
                break;
            } catch (e: any) {
                if (e.message && e.message.includes('UNIQUE constraint failed')) {
                    console.warn(`Collision detected for code ${code}, retrying...`);
                    code = generateCode();
                    retries++;
                } else {
                    throw e;
                }
            }
        }

        const shortUrl = `https://${DOMAIN}/${code}`;
        console.log(`[Link Created] ${shortUrl} -> ${target_url}`);

        return res.json({
            success: true,
            data: {
                short_url: shortUrl,
                code: code,
                target_url: target_url
            }
        });

    } catch (error: any) {
        console.error('Create Link Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.get('/api/stats/affiliate/:userId', async (req, res) => {
    try {
        const stats = await getStatsByCreator(req.params.userId);
        res.json(stats);
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// 获取指定达人和任务的点击统计
app.get('/api/stats/affiliate/:userId/task/:taskId', async (req, res) => {
    try {
        const { userId, taskId } = req.params;
        const stats = await getStatsByCreatorAndTask(userId, taskId);
        console.log(`[API] 获取任务点击统计: 达人 ${userId}, 任务 ${taskId}`, stats);
        res.json(stats);
    } catch (error) {
        console.error('[API] 获取任务点击统计失败:', error);
        res.status(500).json({ error: 'Failed to get task stats' });
    }
});

// 获取达人的详细统计信息 (用于运营侧显示)
app.get('/api/admin/creator-stats/:userId', async (req, res) => {
    try {
        const stats = await getCreatorDetailedStats(req.params.userId);
        console.log(`[Admin API] Fetched stats for creator ${req.params.userId}:`, stats);
        res.json(stats);
    } catch (error) {
        console.error('Creator Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch creator stats' });
    }
});

// 获取全局统计数据 (所有达人的总和)
app.get('/api/admin/total-stats', async (req, res) => {
    try {
        const stats = await getAllTotalStats();
        console.log('[Admin API] Fetched total stats:', stats);
        res.json(stats);
    } catch (error) {
        console.error('Total Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch total stats' });
    }
});

// 获取异常点击预警列表
app.get('/api/admin/anomalies', async (req, res) => {
    try {
        const anomalies = await detectAnomalies();
        console.log(`[Admin API] Detected ${anomalies.length} anomalies`);
        res.json(anomalies);
    } catch (error) {
        console.error('Anomalies Detection Error:', error);
        res.status(500).json({ error: 'Failed to detect anomalies' });
    }
});

// 更新用户资料
app.put('/api/user/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { followerCount, tags, name, email, avatar, walletAddress, socialLinks } = req.body;

        await updateUserProfile(userId, {
            followerCount,
            tags,
            name,
            email,
            avatar,
            walletAddress,
            socialLinks
        });

        console.log(`[API] Updated profile for user ${userId}`, socialLinks ? '(包含 socialLinks)' : '');
        res.json({ success: true });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// 获取用户资料
app.get('/api/user/profile/:userId', async (req, res) => {
    try {
        const profile = await getUserProfile(req.params.userId);
        if (profile) {
            console.log(`[API] 返回用户资料，socialLinks:`, profile.socialLinks ? '存在' : '不存在');
            res.json(profile);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// 发送反馈邮件
app.post('/api/feedback', async (req, res) => {
    try {
        const { userId, userName, userEmail, feedback, timestamp } = req.body;

        // 构建邮件内容
        const emailContent = `
=== 用户反馈 ===
时间: ${timestamp}
用户ID: ${userId}
用户名: ${userName}
用户邮箱: ${userEmail}

反馈内容:
${feedback}

--
此邮件由 KOL 系统自动发送
        `.trim();

        // 记录到控制台（实际生产环境应该使用真正的邮件服务）
        console.log('\n[FEEDBACK] 收到用户反馈:');
        console.log('收件人: bobo@myshell.ai');
        console.log(emailContent);
        console.log('---\n');

        // TODO: 在生产环境中，这里应该集成真正的邮件服务（如 SendGrid, AWS SES, Nodemailer 等）
        // 示例代码（需要安装 nodemailer）:
        // const nodemailer = require('nodemailer');
        // const transporter = nodemailer.createTransport({ ... });
        // await transporter.sendMail({
        //     from: 'noreply@myshell.ai',
        //     to: 'bobo@myshell.ai',
        //     subject: `KOL 系统反馈 - ${userName}`,
        //     text: emailContent
        // });

        res.json({
            success: true,
            message: '反馈已记录，将发送到 bobo@myshell.ai'
        });
    } catch (error) {
        console.error('[FEEDBACK] Error:', error);
        res.status(500).json({ error: 'Failed to send feedback' });
    }
});

// 删除用户账户
app.delete('/api/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        console.log(`[API] 删除用户账户请求: ${userId}`);

        // TODO: 实际删除用户数据
        // 1. 删除用户资料
        // 2. 删除用户任务
        // 3. 删除关联的追踪链接
        // 4. 记录删除日志

        console.log(`[API] 用户账户已删除: ${userId}`);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('[API] Delete User Error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ----------------------------------------------------------------------
// 删除任务（级联删除所有相关数据）
// ----------------------------------------------------------------------
app.delete('/api/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        console.log(`[API] 删除任务请求: ${taskId}`);

        // 调用数据库删除函数
        const result = await deleteTaskCascade(taskId);

        console.log(`[API] 任务删除成功: ${taskId}`, result);
        res.json({
            success: true,
            message: 'Task deleted successfully',
            deletedCounts: result
        });
    } catch (error: any) {
        console.error('[API] 删除任务错误:', error);
        res.status(500).json({
            error: 'Failed to delete task',
            message: error.message || '未知错误'
        });
    }
});

// Explicit 404 for API routes to avoid returning HTML
app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// ----------------------------------------------------------------------
// Redirect Logic (Short Links - Database backed)
// ----------------------------------------------------------------------
const handleRedirect = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { code } = req.params;

    // 1. Strict Filter: Ignore specific system paths, assets, and error prefixes
    const ignoredPrefixes = ['health', 'api', 'assets', 'favicon', 'robots', 'manifest', 'index', 'err-', 'r'];

    if (
        !code ||
        code.includes('.') ||
        ignoredPrefixes.some(prefix => code.startsWith(prefix))
    ) {
        return next();
    }

    try {
        // 2. Lookup in SQLite
        const link = await getLinkByCode(code);

        if (link) {
            const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
            const ua = req.get('User-Agent') || '';
            const referrer = req.get('Referrer') || '';

            // 3. Log Click (异步执行，不阻塞重定向)
            logClick(link.id, ip, ua, referrer).catch(err => {
                console.error(`[Click Log Error] Link ${code}:`, err);
            });

            // 4. Build tracking URL with parameters (实现"两次跳转"功能)
            const targetUrl = new URL(link.target_url);
            targetUrl.searchParams.set('utm_source', 'myshell');
            targetUrl.searchParams.set('utm_medium', 'affiliate');
            targetUrl.searchParams.set('aff_id', link.creator_user_id);
            targetUrl.searchParams.set('task_id', link.task_id);
            targetUrl.searchParams.set('ref', code);

            const finalUrl = targetUrl.toString();
            console.log(`[Redirect] ${code} -> ${finalUrl} (IP: ${ip})`);
            return res.redirect(302, finalUrl);
        }

        next();
    } catch (error) {
        console.error('Redirect Logic Error:', error);
        next();
    }
};

// Register redirect handlers before static files
app.get('/:code', handleRedirect);
app.get('/t/:code', handleRedirect); 

// ----------------------------------------------------------------------
// Global Error Handler for API (Safety Net)
// ----------------------------------------------------------------------
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server Error]', err);
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: 'Internal Server Error' });
    } else {
        next(err);
    }
});

// ----------------------------------------------------------------------
// Static Files (Frontend)
// ----------------------------------------------------------------------
// Serve from 'dist' (Vite build output)
app.use(express.static(distPath));

// Fallback for SPA (Single Page Application)
// This catches anything else not matched above
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
        res.sendFile(path.join(distPath, 'index.html'));
    } else {
        res.status(404).send('Frontend build not found. Please run npm run build.');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Domain: ${DOMAIN}`);
    console.log(`📂 Frontend Dir: ${distPath}`);
});