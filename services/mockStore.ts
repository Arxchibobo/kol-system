import { User, Task, AffiliateTask, UserRole, Tier, TaskStatus, Settlement, SettlementStatus, TIER_RATES, ApprovalStatus } from '../types';

// Initial Mock Data Structure (will be hydrated from localStorage)
const MOCK_ADMIN: User = {
  id: 'admin-1',
  name: 'MyShell Ops',
  email: 'admin@myshell.ai',
  role: UserRole.ADMIN,
  avatar: 'https://ui-avatars.com/api/?name=MyShell+Ops&background=0D8ABC&color=fff&bold=true', 
};

// Storage Keys
const STORAGE_KEY_TASKS = 'myshell_mock_tasks';
const STORAGE_KEY_AFFILIATES = 'myshell_mock_affiliates';
const STORAGE_KEY_AFF_TASKS = 'myshell_mock_aff_tasks';

// Initial Data Sets (Empty by default, populated if storage is empty)
const INITIAL_TASKS: Task[] = [
  {
    id: 't-zootopia-2',
    title: 'Zootopia 2 Poster Maker',
    description: 'Create your own Zootopia style poster! High conversion rate for general audiences. Users can upload photos to generate customized movie posters.',
    productLink: 'https://art.myshell.ai/cosplay/zootopia-2-poster-maker',
    rewardRate: 60,
    status: TaskStatus.ACTIVE,
    createdAt: '2023-11-01',
    deadline: '2024-12-31',
    requirements: ['Share generated poster results', 'Use hashtag #Zootopia2 #MyShell']
  },
  {
    id: 't-1',
    title: 'MyShell AI Voice Beta Launch',
    description: 'Promote our new TTS features. Focus on the realism and emotion.',
    productLink: 'https://myshell.ai/voice',
    rewardRate: 50,
    status: TaskStatus.ACTIVE,
    createdAt: '2023-10-01',
    deadline: '2023-12-31',
    requirements: ['Must use hashtag #MyShellAI', 'Video must be > 30s']
  },
  {
    id: 't-2',
    title: 'Creator Economy Grant',
    description: 'Invite developers to build widgets on MyShell.',
    productLink: 'https://myshell.ai/creators',
    rewardRate: 80,
    status: TaskStatus.ACTIVE,
    createdAt: '2023-10-15',
    deadline: '2023-11-30',
    requirements: ['Target Dev communities', 'Mention the $10k grant']
  }
];

// Mutable Stores
let MOCK_AFFILIATES: User[] = [];
let MOCK_TASKS: Task[] = [];
let MOCK_AFFILIATE_TASKS: AffiliateTask[] = [];

// --- Persistence Logic ---
const loadData = () => {
    try {
        // 🔧 修复：优先从 localStorage 加载 tasks 作为备份
        // 如果后端数据库为空（首次部署或数据丢失），可以从 localStorage 恢复
        const storedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
        if (storedTasks) {
            MOCK_TASKS = JSON.parse(storedTasks);
            console.log(`[loadData] 从 localStorage 加载 ${MOCK_TASKS.length} 个任务作为初始数据`);
        } else {
            MOCK_TASKS = [];
            console.log('[loadData] localStorage 无任务数据，初始化为空数组');
        }

        const storedAffiliates = localStorage.getItem(STORAGE_KEY_AFFILIATES);
        if (storedAffiliates) {
            MOCK_AFFILIATES = JSON.parse(storedAffiliates);
        }

        const storedAffTasks = localStorage.getItem(STORAGE_KEY_AFF_TASKS);
        if (storedAffTasks) {
            MOCK_AFFILIATE_TASKS = JSON.parse(storedAffTasks);
        }
    } catch (e) {
        console.error("Failed to load mock data from storage", e);
        MOCK_TASKS = [];
    }
};

const saveData = () => {
    try {
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(MOCK_TASKS));
        localStorage.setItem(STORAGE_KEY_AFFILIATES, JSON.stringify(MOCK_AFFILIATES));
        localStorage.setItem(STORAGE_KEY_AFF_TASKS, JSON.stringify(MOCK_AFFILIATE_TASKS));
    } catch (e) {
        console.error("Failed to save mock data", e);
    }
};

loadData();

// Helper: Fetch with Retry and Error Handling
async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 300): Promise<Response> {
    try {
        const res = await fetch(url, options);
        // If server error (5xx), throw to trigger retry
        if (res.status >= 500) {
            throw new Error(`Server Error ${res.status}`);
        }
        return res;
    } catch (err) {
        if (retries > 0) {
            console.log(`[FetchRetry] Retrying ${url} in ${backoff}ms... (${retries} left)`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
}

// Store Logic
export const MockStore = {
  login: async (email: string): Promise<User | null> => {
    // Removed artificial delay for snappy performance
    if (email.includes('admin') || email.includes('ops')) return MOCK_ADMIN;
    
    const foundAffiliate = MOCK_AFFILIATES.find(u => u.email === email);
    if (foundAffiliate) {
        try {
            // 1. 获取统计数据
            const statsRes = await fetch(`/api/stats/affiliate/${foundAffiliate.id}`);
            if (statsRes.ok) {
                const contentType = statsRes.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const stats = await statsRes.json();
                    foundAffiliate.totalClicks = stats.totalClicks;
                    foundAffiliate.validClicks = Math.floor(stats.totalClicks * 0.8);
                }
            }

            // 2. 获取用户资料数据（所有字段）
            const profileRes = await fetch(`/api/user/profile/${foundAffiliate.id}`);
            if (profileRes.ok) {
                const profile = await profileRes.json();
                // 合并数据库中的所有字段，确保完整的数据同步
                foundAffiliate.followerCount = profile.follower_count || foundAffiliate.followerCount || 0;
                foundAffiliate.tags = profile.tags || (foundAffiliate.tags || []);
                foundAffiliate.tier = profile.tier || foundAffiliate.tier;
                foundAffiliate.walletAddress = profile.wallet_address || foundAffiliate.walletAddress;
                foundAffiliate.totalEarnings = profile.total_earnings || foundAffiliate.totalEarnings || 0;
                foundAffiliate.pendingEarnings = profile.pending_earnings || foundAffiliate.pendingEarnings || 0;

                // 同步 socialLinks 字段（防止 Profile 页面崩溃）
                // 后端返回的字段名是 socialLinks（驼峰命名）
                if (profile.socialLinks) {
                    foundAffiliate.socialLinks = profile.socialLinks;
                } else if (!foundAffiliate.socialLinks) {
                    // 如果后端和本地都没有 socialLinks，初始化为空对象
                    foundAffiliate.socialLinks = {
                        twitter: '',
                        instagram: '',
                        youtube: '',
                        tiktok: '',
                        linkedin: '',
                        reddit: '',
                        facebook: '',
                        twitch: '',
                        discord: ''
                    };
                }
            }
        } catch (e) {
            console.warn("Failed to fetch backend data", e);
        }
        return foundAffiliate;
    }

    if (email === 'ninja@influencer.com') {
        return {
            id: 'demo-ninja',
            name: 'Crypto Ninja (Demo)',
            email: 'ninja@influencer.com',
            role: UserRole.AFFILIATE,
            avatar: 'https://i.pravatar.cc/150?u=ninja',
            tier: Tier.SILVER,
            totalEarnings: 0,
            pendingEarnings: 0,
            totalClicks: 0,
            validClicks: 0,
            followerCount: 50000,
            socialLinks: { twitter: 'https://x.com/demo' }
        };
    }
    return null;
  },

  register: async (data: { name: string; email: string; socialLinks: any }): Promise<User> => {
    await new Promise(r => setTimeout(r, 1000));
    const existing = MOCK_AFFILIATES.find(u => u.email === data.email);
    if (existing) return existing;

    const simulatedFollowerCount = Math.floor(Math.random() * 50000) + 1000;
    const newUser: User = {
        id: `reg-${Date.now()}`,
        name: data.name,
        email: data.email,
        role: UserRole.AFFILIATE,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random`,
        approvalStatus: ApprovalStatus.PENDING, // 新注册用户默认为待审核状态
        tier: Tier.CORE_PARTNER, // 默认设置为基础合作伙伴
        totalEarnings: 0,
        pendingEarnings: 0,
        totalClicks: 0,
        validClicks: 0,
        followerCount: simulatedFollowerCount,
        socialLinks: data.socialLinks,
        walletAddress: ''
    };

    MOCK_AFFILIATES.unshift(newUser);
    saveData();

    // 🔧 调试日志：确认新用户已注册
    console.log('[MockStore] ✅ 新用户已注册，等待审核:', {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      approvalStatus: newUser.approvalStatus
    });
    console.log('[MockStore] 当前 MOCK_AFFILIATES 数量:', MOCK_AFFILIATES.length);
    console.log('[MockStore] 当前待审核用户数量:', MOCK_AFFILIATES.filter(u => u.approvalStatus === ApprovalStatus.PENDING).length);

    // 同步到后端数据库
    try {
        await fetch(`/api/user/profile/${newUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newUser.name,
                email: newUser.email,
                avatar: newUser.avatar,
                followerCount: newUser.followerCount,
                socialLinks: newUser.socialLinks,
                walletAddress: newUser.walletAddress
            })
        });
        console.log(`✅ 新用户资料已同步到后端: ${newUser.id}`);
    } catch (e) {
        console.warn("⚠️ 注册时同步用户资料到后端失败:", e);
    }

    return newUser;
  },

  // 批量注册用户（用于 CSV 导入）
  batchRegister: async (users: Partial<User>[]): Promise<{ success: number; skipped: number; errors: string[] }> => {
    const result = {
      success: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const userData of users) {
      try {
        // 生成唯一标识（优先使用 Instagram handle，其次 email，最后使用 name）
        let uniqueKey = '';
        if (userData.socialLinks?.instagram) {
          // 从 Instagram URL 提取 handle
          const instagramHandle = userData.socialLinks.instagram.split('/').filter(Boolean).pop();
          uniqueKey = instagramHandle?.toLowerCase() || '';
        }

        if (!uniqueKey && userData.email) {
          uniqueKey = userData.email.toLowerCase();
        }

        if (!uniqueKey && userData.name) {
          uniqueKey = userData.name.toLowerCase();
        }

        if (!uniqueKey) {
          result.skipped++;
          result.errors.push(`跳过用户: 无法生成唯一标识`);
          continue;
        }

        // 检查是否已存在（基于多个字段检查去重）
        const existing = MOCK_AFFILIATES.find(u => {
          // 优先通过 Instagram handle 去重
          if (userData.socialLinks?.instagram && u.socialLinks?.instagram) {
            const newHandle = userData.socialLinks.instagram.split('/').filter(Boolean).pop()?.toLowerCase();
            const existingHandle = u.socialLinks.instagram.split('/').filter(Boolean).pop()?.toLowerCase();
            if (newHandle && existingHandle && newHandle === existingHandle) return true;
          }

          // 如果都有邮箱，通过邮箱去重
          if (userData.email && u.email && userData.email.toLowerCase() === u.email.toLowerCase()) {
            return true;
          }

          // 最后通过名称去重
          if (userData.name && u.name && userData.name.toLowerCase() === u.name.toLowerCase()) {
            return true;
          }

          return false;
        });

        if (existing) {
          result.skipped++;
          result.errors.push(`跳过用户 "${userData.name}": 已存在`);
          continue;
        }

        // 生成邮箱（如果没有邮箱，使用 Instagram handle 生成临时邮箱）
        let email = userData.email || '';
        if (!email && userData.socialLinks?.instagram) {
          const handle = userData.socialLinks.instagram.split('/').filter(Boolean).pop();
          email = `${handle}@instagram.imported`;
        }
        if (!email && userData.name) {
          email = `${userData.name.toLowerCase().replace(/\s+/g, '_')}@imported.myshell`;
        }

        // 创建新用户
        const newUser: User = {
          id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: userData.name || 'Unknown',
          email: email,
          role: UserRole.AFFILIATE,
          avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'U')}&background=random`,
          tier: userData.tier || Tier.CORE_PARTNER,
          totalEarnings: userData.totalEarnings || 0,
          pendingEarnings: userData.pendingEarnings || 0,
          totalClicks: userData.totalClicks || 0,
          validClicks: userData.validClicks || 0,
          followerCount: userData.followerCount || 0,
          socialLinks: userData.socialLinks || {},
          walletAddress: userData.walletAddress || '',
          tags: userData.tags || [],
          notificationSettings: userData.notificationSettings || { newTaskAlert: true }
        };

        MOCK_AFFILIATES.unshift(newUser);
        result.success++;

        // 同步到后端数据库
        try {
          await fetch(`/api/user/profile/${newUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newUser.name,
              email: newUser.email,
              avatar: newUser.avatar,
              tier: newUser.tier,
              followerCount: newUser.followerCount,
              socialLinks: newUser.socialLinks,
              walletAddress: newUser.walletAddress,
              tags: newUser.tags
            })
          });
        } catch (e) {
          console.warn(`⚠️ 同步用户 ${newUser.id} 到后端失败:`, e);
        }
      } catch (error) {
        result.errors.push(`导入用户 "${userData.name}" 失败: ${error}`);
      }
    }

    // 保存到 localStorage
    saveData();

    console.log(`📊 批量导入完成: 成功 ${result.success}, 跳过 ${result.skipped}`);
    return result;
  },

  getTasks: async (role: UserRole): Promise<Task[]> => {
    try {
      // 优先从后端获取最新数据
      console.log('🔄 正在从后端获取任务列表...');
      const response = await fetch('/api/tasks');

      if (response.ok) {
        const backendTasks = await response.json();

        // 🔧 修复：如果后端数据为空但本地有数据，将本地数据同步回后端
        if (backendTasks.length === 0 && MOCK_TASKS.length > 0) {
          console.warn('⚠️ 后端数据为空，但本地有 ' + MOCK_TASKS.length + ' 个任务，正在同步回后端...');

          // 将本地任务同步到后端
          for (const task of MOCK_TASKS) {
            try {
              await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
              });
              console.log(`✅ 任务 "${task.title}" 已同步到后端`);
            } catch (e) {
              console.error(`❌ 同步任务 "${task.title}" 失败:`, e);
            }
          }

          // 同步完成后，返回本地数据
          console.log('✅ 数据同步完成，使用本地数据');
          return JSON.parse(JSON.stringify(MOCK_TASKS));
        }

        // 如果后端有数据，更新本地缓存
        if (backendTasks.length > 0) {
          MOCK_TASKS = backendTasks;
          saveData();
          console.log(`✅ 从后端成功获取 ${backendTasks.length} 个任务`);
        }

        return JSON.parse(JSON.stringify(backendTasks));
      } else {
        console.warn(`⚠️ 后端返回错误状态: ${response.status}`);
      }
    } catch (error) {
      console.warn('⚠️ 从后端获取任务失败，使用本地缓存:', error);
    }

    // 后端失败时使用本地缓存
    console.log(`📦 使用本地缓存，共 ${MOCK_TASKS.length} 个任务`);
    return JSON.parse(JSON.stringify(MOCK_TASKS));
  },

  getMyTasks: async (affiliateId: string): Promise<AffiliateTask[]> => {
    return MOCK_AFFILIATE_TASKS.filter(at => at.affiliateId === affiliateId);
  },

  claimTask: async (affiliateId: string, task: Task): Promise<AffiliateTask> => {
    const uniqueId = `at-${Date.now()}`;
    let trackingLink = '';
    
    try {
        // --- CALL BACKEND TO CREATE REAL SHORT LINK ---
        console.log('[前端] 请求生成短链接:', {
            creator_user_id: affiliateId,
            task_id: task.id,
            campaign_id: task.id,
            target_url: task.productLink
        });
        const response = await fetchWithRetry('/api/tracking-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creator_user_id: affiliateId,
                task_id: task.id,
                campaign_id: task.id,
                target_url: task.productLink
            })
        }, 3, 400); // 3 Retries

        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            if (contentType && contentType.includes('application/json')) {
                const errJson = await response.json();
                throw new Error(errJson.error || 'Server Error');
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        }

        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('[前端] 短链接生成响应:', result);
            if (result.success) {
                trackingLink = result.data.short_url;
                console.log('[前端] ✅ 短链接生成成功:', trackingLink);
            } else {
                throw new Error(result.error);
            }
        } else {
            throw new Error("Invalid response format");
        }

    } catch (e: any) {
        console.error("❌ 短链接生成失败:", e);
        
        // 不再使用 fallback 长链接，而是抛出错误让用户知道
        throw new Error(
            '短链接生成失败。请确保后端服务器正在运行。\n' +
            '运行命令: npm run dev\n' +
            '错误详情: ' + (e.message || e)
        );
    }

    const newAT: AffiliateTask = {
      id: uniqueId,
      affiliateId,
      taskId: task.id,
      uniqueTrackingLink: trackingLink,
      status: 'CLAIMED',
      stats: { totalClicks: 0, validClicks: 0, conversionRate: 0, estimatedEarnings: 0 }
    };
    MOCK_AFFILIATE_TASKS.push(newAT);

    saveData();

    // 🔧 调试日志：确认任务已认领
    console.log('[MockStore] ✅ 任务已认领，任务记录:', {
      affiliateTaskId: newAT.id,
      affiliateId: newAT.affiliateId,
      taskId: newAT.taskId,
      trackingLink: newAT.uniqueTrackingLink
    });
    console.log('[MockStore] 当前 MOCK_AFFILIATE_TASKS 数量:', MOCK_AFFILIATE_TASKS.length);

    return newAT;
  },

  // 删除/释放已领取的任务
  releaseTask: async (affiliateTaskId: string): Promise<void> => {
    try {
      console.log('[MockStore] 释放任务:', affiliateTaskId);
      const response = await fetch(`/api/affiliate-tasks/${affiliateTaskId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '释放任务失败');
      }

      // 从本地数组中移除
      const index = MOCK_AFFILIATE_TASKS.findIndex(at => at.id === affiliateTaskId);
      if (index !== -1) {
        MOCK_AFFILIATE_TASKS.splice(index, 1);
        saveData();
      }

      console.log('[MockStore] ✅ 任务释放成功');
    } catch (error: any) {
      console.error('[MockStore] 释放任务失败:', error);
      throw error;
    }
  },

  // Handle client-side redirection for fallback links
  handleClientRedirect: async (path: string): Promise<string | null> => {
      // Logic: 
      // 1. Path is like "/r/[base64_payload]"
      // 2. Extract payload, decode it.
      // 3. Update stats if possible (local).
      // 4. Return destination URL.
      
      try {
          const parts = path.split('/r/');
          if (parts.length < 2) return null;
          
          let base64 = parts[1].split('?')[0]; // Remove query params if any
          
          if (!base64) return null;

          // Robust Decoding
          // 1. URL Decode first (in case browser encoded it to %20 etc)
          try {
            base64 = decodeURIComponent(base64);
          } catch (e) {
            // Ignore if already clean
          }

          // 2. Restore Standard Base64 from URL Safe: - -> +, _ -> /
          base64 = base64.replace(/-/g, '+').replace(/_/g, '/');

          // 3. Restore padding (optional in JS atob but good practice)
          while (base64.length % 4) {
              base64 += '=';
          }
          
          const jsonStr = atob(base64);
          const data = JSON.parse(jsonStr); // { u: url, t: taskId }
          
          if (data && data.u) {
              console.log(`[ClientRedirect] Decoded stateless link for task ${data.t}`);
              
              // --- Local Stats Update (Best Effort) ---
              const affTask = MOCK_AFFILIATE_TASKS.find(at => at.taskId === data.t);
              if (affTask) {
                  affTask.stats.totalClicks += 1;
                  affTask.stats.validClicks += 1;
                  const user = MOCK_AFFILIATES.find(u => u.id === affTask.affiliateId);
                  if (user) {
                      user.totalClicks = (user.totalClicks || 0) + 1;
                      user.validClicks = (user.validClicks || 0) + 1;
                      const rate = TIER_RATES[user.tier || Tier.CORE_PARTNER];
                      const earning = rate / 1000;
                      user.totalEarnings = (user.totalEarnings || 0) + earning;
                      user.pendingEarnings = (user.pendingEarnings || 0) + earning;
                      affTask.stats.estimatedEarnings += earning;
                  }
                  saveData();
              }
              
              return data.u;
          }
      } catch (e) {
          console.error("Failed to decode fallback link:", e);
      }
      
      return null;
  },
  
  giveUpTask: async (affTaskId: string) => {
      MOCK_AFFILIATE_TASKS = MOCK_AFFILIATE_TASKS.filter(at => at.id !== affTaskId);
      saveData();
  },

  simulateLinkClick: async (trackingLink: string): Promise<{ success: boolean; destination?: string; message: string }> => {
      console.log(`[Simulation] GET ${trackingLink}`);
      try {
        await fetch(trackingLink, { method: 'GET', mode: 'no-cors' });
      } catch (e) {
        console.warn("[Simulation] Network ping failed, proceeding with local stats update anyway.");
      }

      // Check if it's a stateless link
      if (trackingLink.includes('/r/')) {
           // Parse the ID from the payload to log the click locally
           const urlObj = new URL(trackingLink);
           await MockStore.handleClientRedirect(urlObj.pathname);
           return { success: true, destination: 'Redirect initiated', message: "Stateless Click Logged" };
      }

      const parts = trackingLink.split('/');
      const code = parts[parts.length - 1];
      
      const affTask = MOCK_AFFILIATE_TASKS.find(at => at.uniqueTrackingLink.includes(code));
      
      if (affTask) {
            affTask.stats.totalClicks += 1;
            affTask.stats.validClicks += 1;
            const user = MOCK_AFFILIATES.find(u => u.id === affTask.affiliateId);
            if (user) {
                user.totalClicks = (user.totalClicks || 0) + 1;
                user.validClicks = (user.validClicks || 0) + 1;
                const rate = TIER_RATES[user.tier || Tier.CORE_PARTNER];
                user.totalEarnings = (user.totalEarnings || 0) + (rate / 1000);
                user.pendingEarnings = (user.pendingEarnings || 0) + (rate / 1000);
                affTask.stats.estimatedEarnings += (rate / 1000);
            }
            saveData();
      }

      return { success: true, destination: 'Redirect initiated', message: "Click logged" };
  },

  submitPost: async (affTaskId: string, link: string) => {
    const task = MOCK_AFFILIATE_TASKS.find(t => t.id === affTaskId);
    if (task) {
      task.submittedPostLink = link;
      task.status = 'SUBMITTED';
      saveData();
    }
  },

  // 获取任务的参与达人列表
  getTaskParticipants: async (taskId: string) => {
    try {
      // 🔧 优先尝试从后端获取
      const response = await fetch(`/api/tasks/${taskId}/participants`);
      if (response.ok) {
        const participants = await response.json();
        console.log('[MockStore] 从后端获取任务参与者:', participants.length);

        // 🔧 修复：如果后端返回空数组，尝试使用本地数据作为 fallback
        if (participants.length === 0) {
          console.log('[MockStore] 后端返回空数据，尝试使用本地 localStorage 数据');
        } else {
          return participants;
        }
      }
    } catch (error: any) {
      console.log('[MockStore] 后端不可用，使用本地数据');
    }

    // 🔧 Fallback: 从本地数据构建参与者列表
    console.log('[MockStore] 总共的 MOCK_AFFILIATE_TASKS:', MOCK_AFFILIATE_TASKS.length);
    console.log('[MockStore] 查询的 taskId:', taskId);

    const affiliateTasks = MOCK_AFFILIATE_TASKS.filter(at => at.taskId === taskId);
    console.log('[MockStore] 本地找到的任务参与:', {
      taskId,
      count: affiliateTasks.length,
      details: affiliateTasks.map(at => ({
        id: at.id,
        affiliateId: at.affiliateId,
        status: at.status,
        trackingLink: at.uniqueTrackingLink
      }))
    });

    const participants = await Promise.all(
      affiliateTasks.map(async (at) => {
        // 查找对应的达人信息
        const affiliate = MOCK_AFFILIATES.find(a => a.id === at.affiliateId);

        // 🔧 尝试从后端获取实时点击数据
        let clickCount = at.stats?.totalClicks || 0;
        try {
          const clickResponse = await fetch(`/api/tracking-links/stats?creator_user_id=${at.affiliateId}&task_id=${taskId}`);
          if (clickResponse.ok) {
            const clickData = await clickResponse.json();
            clickCount = clickData.click_count || 0;
            console.log(`[MockStore] 达人 ${affiliate?.name} 的点击数: ${clickCount}`);
          }
        } catch (e) {
          console.log('[MockStore] 无法获取实时点击数，使用本地数据');
        }

        return {
          affiliateTaskId: at.id,
          affiliateId: at.affiliateId,
          affiliateName: affiliate?.name || 'Unknown',
          affiliateEmail: affiliate?.email || 'N/A',
          affiliateTier: affiliate?.tier || 'CORE_PARTNER',
          totalClicks: clickCount,
          validClicks: at.stats?.validClicks || 0,
          estimatedEarnings: at.stats?.estimatedEarnings || 0,
          status: at.status || 'CLAIMED',
          submittedPostLink: at.submittedPostLink || '',
          trackingLink: at.uniqueTrackingLink || ''
        };
      })
    );

    console.log('[MockStore] 最终返回的参与者列表:', participants.length, participants);
    return participants;
  },

  getStats: async (userId: string, role: UserRole) => {
    try {
      // 调用后端 API 获取真实的每日统计数据
      const endpoint = role === UserRole.ADMIN
        ? '/api/stats/daily'  // 运营侧获取全局统计
        : `/api/stats/daily/${userId}`;  // 达人侧获取个人统计

      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();
        console.log(`[MockStore] 获取每日统计成功 (${role}):`, data);
        return data;
      } else {
        console.warn(`[MockStore] 获取每日统计失败, 使用空数据`);
        // 返回空数据作为 fallback
        const data = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          data.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            clicks: 0,
            valid: 0,
          });
        }
        return data;
      }
    } catch (error) {
      console.error('[MockStore] 获取每日统计失败:', error);
      // 返回空数据作为 fallback
      const data = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        data.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          clicks: 0,
          valid: 0,
        });
      }
      return data;
    }
  },

  createTask: async (task: Task) => {
    const taskWithId = { ...task };
    if (!taskWithId.id) {
        taskWithId.id = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    if (!taskWithId.status) {
        taskWithId.status = TaskStatus.ACTIVE;
    }

    try {
      // 先保存到后端
      console.log('💾 正在保存任务到后端...');
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskWithId)
      });

      if (response.ok) {
        console.log(`✅ 任务已成功保存到后端: ${taskWithId.title}`);
      } else {
        console.warn(`⚠️ 后端保存任务失败，状态: ${response.status}`);
      }
    } catch (error) {
      console.warn('⚠️ 保存任务到后端失败:', error);
    }

    // 更新本地缓存
    MOCK_TASKS.unshift(taskWithId);
    saveData();
  },

  updateTask: async (task: Task) => {
    const index = MOCK_TASKS.findIndex(t => t.id === task.id);
    if (index !== -1) {
      try {
        // 先更新后端
        console.log('🔄 正在更新任务到后端...');
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });

        if (response.ok) {
          console.log(`✅ 任务已成功更新到后端: ${task.title}`);
        } else {
          console.warn(`⚠️ 后端更新任务失败，状态: ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ 更新任务到后端失败:', error);
      }

      // 更新本地缓存
      MOCK_TASKS[index] = task;
      saveData();
    }
  },

  stopTask: async (taskId: string) => {
    const task = MOCK_TASKS.find(t => t.id === taskId);
    if (task) {
        task.status = TaskStatus.ENDED;
        saveData();
    }
  },

  restartTask: async (taskId: string) => {
    const task = MOCK_TASKS.find(t => t.id === taskId);
    if (task) {
        task.status = TaskStatus.ACTIVE;
        saveData();
    }
  },

  // 删除任务（从 localStorage 中移除）
  deleteTask: async (taskId: string) => {
    const taskIndex = MOCK_TASKS.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const deletedTask = MOCK_TASKS[taskIndex];

      try {
        // 先删除后端数据
        console.log('🗑️ 正在从后端删除任务...');
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          console.log(`✅ 任务已成功从后端删除: ${deletedTask.title}`);
        } else {
          console.warn(`⚠️ 后端删除任务失败，状态: ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ 从后端删除任务失败:', error);
      }

      // 1. 从任务列表中移除
      MOCK_TASKS.splice(taskIndex, 1);
      console.log(`[MockStore] 删除任务: ${deletedTask.title} (${taskId})`);

      // 2. 删除所有相关的达人任务记录
      const affTasksBefore = MOCK_AFFILIATE_TASKS.length;
      MOCK_AFFILIATE_TASKS.splice(0, MOCK_AFFILIATE_TASKS.length,
        ...MOCK_AFFILIATE_TASKS.filter(at => at.taskId !== taskId)
      );
      const affTasksDeleted = affTasksBefore - MOCK_AFFILIATE_TASKS.length;
      console.log(`[MockStore] 删除了 ${affTasksDeleted} 条达人任务记录`);

      // 3. 保存到 localStorage
      saveData();

      return {
        success: true,
        taskDeleted: true,
        affiliateTasksDeleted: affTasksDeleted
      };
    } else {
      throw new Error(`Task not found: ${taskId}`);
    }
  },

  getAffiliates: async () => {
    // 从后端获取所有用户的最新资料数据（tags, followerCount 等）
    // 并合并到 MOCK_AFFILIATES 中
    const enrichedAffiliates = await Promise.all(
      MOCK_AFFILIATES.map(async (affiliate) => {
        try {
          const response = await fetch(`/api/user/profile/${affiliate.id}`);
          if (response.ok) {
            const profile = await response.json();
            // 合并数据库中的所有字段到 affiliate 对象，确保完整的数据同步
            return {
              ...affiliate,
              followerCount: profile.follower_count || affiliate.followerCount || 0,
              tags: profile.tags || (affiliate.tags || []),
              tier: profile.tier || affiliate.tier,
              walletAddress: profile.wallet_address || affiliate.walletAddress,
              totalEarnings: profile.total_earnings || affiliate.totalEarnings || 0,
              pendingEarnings: profile.pending_earnings || affiliate.pendingEarnings || 0
            };
          }
        } catch (error) {
          console.warn(`无法获取用户 ${affiliate.id} 的资料:`, error);
        }
        return affiliate;
      })
    );
    return enrichedAffiliates;
  },

  addAffiliate: async (user: User) => {
      MOCK_AFFILIATES.unshift(user);
      saveData();
  },

  updateAffiliate: async (user: User) => {
    const index = MOCK_AFFILIATES.findIndex(u => u.id === user.id);
    if (index !== -1) {
      MOCK_AFFILIATES[index] = user;
      saveData();
    }
  },

  deleteAffiliate: async (userId: string) => {
    // 从达人列表中删除
    MOCK_AFFILIATES = MOCK_AFFILIATES.filter(u => u.id !== userId);

    // 删除该达人的所有任务
    MOCK_AFFILIATE_TASKS = MOCK_AFFILIATE_TASKS.filter(at => at.affiliateId !== userId);

    saveData();
    console.log(`[MockStore] 已删除达人: ${userId}`);
  },

  syncKOLs: async () => {
      await new Promise(r => setTimeout(r, 1000));
      return 5; 
  },

  getSettlements: async () => {
      return [
          { id: 's1', affiliateId: 'a1', affiliateName: 'Crypto Ninja', amount: 1250.50, period: '2023-10', status: SettlementStatus.PAID, transactionHash: '0x123...abc', date: '2023-11-01' },
          { id: 's2', affiliateId: 'a2', affiliateName: 'Jane Doe', amount: 300.00, period: '2023-10', status: SettlementStatus.PENDING, date: '2023-11-01' }
      ];
  },

  getAdminOverviewStats: async () => {
      return {
          totalClicks: MOCK_AFFILIATE_TASKS.reduce((acc, curr) => acc + curr.stats.totalClicks, 0),
          pendingPayout: MOCK_AFFILIATES.reduce((acc, curr) => acc + (curr.pendingEarnings || 0), 3500),
          flaggedCount: 12
      };
  },

  // 更新用户最后查看任务的时间戳
  updateLastSeenTaskTimestamp: async (userId: string) => {
    const user = MOCK_AFFILIATES.find(u => u.id === userId);
    if (user) {
      user.lastSeenTaskTimestamp = new Date().toISOString();
      saveData();
      console.log(`[MockStore] 更新用户 ${userId} 最后查看任务时间: ${user.lastSeenTaskTimestamp}`);
    }
  },

  // 更新通知设置
  updateNotificationSettings: async (userId: string, settings: { newTaskAlert: boolean }) => {
    const user = MOCK_AFFILIATES.find(u => u.id === userId);
    if (user) {
      user.notificationSettings = settings;
      saveData();
      console.log(`[MockStore] 更新用户 ${userId} 通知设置:`, settings);
    }
  },

  // ----------------------------------------------------------------------
  // 提现相关方法
  // ----------------------------------------------------------------------

  // 创建提现请求
  createWithdrawalRequest: async (data: {
    affiliateId: string;
    affiliateName: string;
    affiliateTaskId: string;
    taskTitle: string;
    amount: number;
    paymentMethod: string;
    paymentDetails: string;
  }) => {
    try {
      console.log('[MockStore] 创建提现请求:', data);
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建提现请求失败');
      }

      const result = await response.json();
      console.log('[MockStore] ✅ 提现请求创建成功:', result);
      return result;
    } catch (error: any) {
      console.error('[MockStore] 创建提现请求失败:', error);
      throw error;
    }
  },

  // 获取所有提现请求（运营侧）
  getAllWithdrawals: async () => {
    try {
      const response = await fetch('/api/withdrawals');
      if (!response.ok) {
        throw new Error('获取提现请求失败');
      }
      const withdrawals = await response.json();
      console.log('[MockStore] 获取到提现请求:', withdrawals.length);
      return withdrawals;
    } catch (error: any) {
      console.error('[MockStore] 获取提现请求失败:', error);
      return [];
    }
  },

  // 获取达人的提现记录
  getAffiliateWithdrawals: async (affiliateId: string) => {
    try {
      const response = await fetch(`/api/withdrawals/affiliate/${affiliateId}`);
      if (!response.ok) {
        throw new Error('获取提现记录失败');
      }
      const withdrawals = await response.json();
      console.log('[MockStore] 获取达人提现记录:', withdrawals.length);
      return withdrawals;
    } catch (error: any) {
      console.error('[MockStore] 获取达人提现记录失败:', error);
      return [];
    }
  },

  // 更新提现状态
  updateWithdrawalStatus: async (
    withdrawalId: string,
    status: string,
    paymentProof?: string,
    adminNotes?: string,
    affiliateId?: string,
    amount?: number,
    taskTitle?: string
  ) => {
    try {
      console.log('[MockStore] 更新提现状态:', withdrawalId, '->', status);
      const response = await fetch(`/api/withdrawals/${withdrawalId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, paymentProof, adminNotes, affiliateId, amount, taskTitle })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新提现状态失败');
      }

      const result = await response.json();
      console.log('[MockStore] ✅ 提现状态更新成功:', result);
      return result;
    } catch (error: any) {
      console.error('[MockStore] 更新提现状态失败:', error);
      throw error;
    }
  },

  // 更新达人等级（运营侧）
  updateAffiliateTier: async (userId: string, tier: string) => {
    try {
      console.log('[MockStore] 更新达人等级:', userId, '->', tier);

      // 更新本地用户对象
      const user = MOCK_AFFILIATES.find(u => u.id === userId);
      if (user) {
        user.tier = tier as any;
      }

      // 同步到数据库
      await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier })
      });

      saveData();
      console.log('[MockStore] ✅ 达人等级更新成功');
    } catch (error: any) {
      console.error('[MockStore] 更新达人等级失败:', error);
      throw error;
    }
  },

  // ----------------------------------------------------------------------
  // 通知相关方法
  // ----------------------------------------------------------------------

  // 获取用户通知
  getNotifications: async (userId: string) => {
    try {
      const response = await fetch(`/api/notifications/${userId}`);
      if (!response.ok) throw new Error('获取通知失败');
      const notifications = await response.json();
      console.log('[MockStore] 获取通知:', notifications.length);
      return notifications;
    } catch (error: any) {
      console.error('[MockStore] 获取通知失败:', error);
      throw error;
    }
  },

  // 获取未读通知数量
  getUnreadNotificationCount: async (userId: string): Promise<number> => {
    try {
      const response = await fetch(`/api/notifications/${userId}/unread-count`);
      if (!response.ok) throw new Error('获取未读通知数量失败');
      const { count } = await response.json();
      return count;
    } catch (error: any) {
      console.error('[MockStore] 获取未读通知数量失败:', error);
      return 0;
    }
  },

  // 标记通知为已读
  markNotificationAsRead: async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      if (!response.ok) throw new Error('标记通知已读失败');
      console.log('[MockStore] 通知已标记为已读:', notificationId);
    } catch (error: any) {
      console.error('[MockStore] 标记通知已读失败:', error);
      throw error;
    }
  },

  // 标记所有通知为已读
  markAllNotificationsAsRead: async (userId: string) => {
    try {
      const response = await fetch(`/api/notifications/${userId}/read-all`, {
        method: 'PUT'
      });
      if (!response.ok) throw new Error('标记所有通知已读失败');
      console.log('[MockStore] 所有通知已标记为已读');
    } catch (error: any) {
      console.error('[MockStore] 标记所有通知已读失败:', error);
      throw error;
    }
  },

  // 🔧 修复：添加 autoImportAllKOLs 函数
  // 自动同步 KOL 数据 - 从数据库加载所有达人信息
  autoImportAllKOLs: async () => {
    try {
      console.log('[MockStore] 🔄 开始自动同步 KOL 数据...');

      // 从数据库获取所有用户资料
      const response = await fetch('/api/users/profiles');
      if (!response.ok) {
        console.warn('[MockStore] ⚠️ 无法获取用户资料，跳过同步');
        return { success: 0, skipped: 0 };
      }

      const profiles = await response.json();
      console.log(`[MockStore] 📊 获取到 ${profiles.length} 个用户资料`);

      let success = 0;
      let skipped = 0;

      // 同步每个用户到本地存储
      for (const profile of profiles) {
        try {
          // 检查是否已存在
          const existingUser = MOCK_AFFILIATES.find(u => u.id === profile.user_id);
          if (existingUser) {
            skipped++;
            continue;
          }

          // 创建新用户对象并添加到本地
          const newUser: User = {
            id: profile.user_id,
            email: profile.email || `user_${profile.user_id}@example.com`,
            name: profile.name || `User ${profile.user_id}`,
            role: 'affiliate',
            tier: profile.tier || 'CORE_PARTNER',
            followerCount: profile.follower_count || 0,
            tags: profile.tags || [],
            walletAddress: profile.wallet_address || '',
            totalEarnings: profile.total_earnings || 0,
            pendingEarnings: profile.pending_earnings || 0,
            validClicks: 0,
            socialLinks: {},
            notificationSettings: {
              newTaskAlert: true
            }
          };

          MOCK_AFFILIATES.push(newUser);
          success++;
        } catch (error) {
          console.error(`[MockStore] ❌ 同步用户 ${profile.user_id} 失败:`, error);
          skipped++;
        }
      }

      saveData();
      console.log(`[MockStore] ✅ KOL 数据同步完成: 成功 ${success}, 跳过 ${skipped}`);
      return { success, skipped };

    } catch (error: any) {
      console.error('[MockStore] ❌ KOL 数据同步失败:', error);
      return { success: 0, skipped: 0 };
    }
  },

  // 获取待审核的达人列表
  getPendingAffiliates: async (): Promise<User[]> => {
    await new Promise(r => setTimeout(r, 100));
    return MOCK_AFFILIATES.filter(u => u.approvalStatus === ApprovalStatus.PENDING);
  },

  // 批准达人
  approveAffiliate: async (userId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    const user = MOCK_AFFILIATES.find(u => u.id === userId);
    if (user) {
      user.approvalStatus = ApprovalStatus.APPROVED;
      user.rejectionReason = undefined; // 清除拒绝原因
      saveData();
      console.log(`[MockStore] ✅ 已批准达人: ${user.name} (${user.email})`);
    }
  },

  // 拒绝达人
  rejectAffiliate: async (userId: string, reason: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    const user = MOCK_AFFILIATES.find(u => u.id === userId);
    if (user) {
      user.approvalStatus = ApprovalStatus.REJECTED;
      user.rejectionReason = reason;
      saveData();
      console.log(`[MockStore] ❌ 已拒绝达人: ${user.name} (${user.email}), 原因: ${reason}`);
    }
  }
};