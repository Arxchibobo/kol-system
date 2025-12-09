import { User, Task, AffiliateTask, UserRole, Tier, TaskStatus, Settlement, SettlementStatus, TIER_RATES } from '../types';

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
        const storedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
        if (storedTasks) {
            MOCK_TASKS = JSON.parse(storedTasks);
            // Ensure Zootopia task exists even if local storage is old
            const zooTask = INITIAL_TASKS[0];
            if (!MOCK_TASKS.find(t => t.id === zooTask.id)) {
                MOCK_TASKS.unshift(zooTask);
            }
        } else {
            MOCK_TASKS = [...INITIAL_TASKS];
            localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(MOCK_TASKS));
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
        MOCK_TASKS = [...INITIAL_TASKS];
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
            const res = await fetch(`/api/stats/affiliate/${foundAffiliate.id}`);
            if (res.ok) {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const stats = await res.json();
                    foundAffiliate.totalClicks = stats.totalClicks;
                    foundAffiliate.validClicks = Math.floor(stats.totalClicks * 0.8); 
                }
            }
        } catch (e) {
            console.warn("Failed to fetch backend stats", e);
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
        tier: Tier.BRONZE,
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
    return newUser;
  },

  getTasks: async (role: UserRole): Promise<Task[]> => {
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
            if (result.success) {
                trackingLink = result.data.short_url; 
            } else {
                throw new Error(result.error);
            }
        } else {
            throw new Error("Invalid response format");
        }

    } catch (e: any) {
        console.error("Link generation failed after retries:", e);
        // --- FALLBACK STRATEGY (STATELESS) ---
        // Generates a URL-safe base64 encoded link that will work via App.tsx interception
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://myshell.site';
        
        // Payload: { "u": "https://...", "t": "task-id" }
        const payload = JSON.stringify({ u: task.productLink, t: task.id });
        
        // Base64 Encode (URL Safe)
        // 1. Standard Encode
        let encoded = btoa(payload);
        // 2. Make URL Safe: + -> -, / -> _, = -> ''
        encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        trackingLink = `${origin}/r/${encoded}`;
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
    return newAT;
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
                      const rate = TIER_RATES[user.tier || Tier.BRONZE];
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
                const rate = TIER_RATES[user.tier || Tier.BRONZE];
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

  getStats: async (userId: string, role: UserRole) => {
    const data = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      data.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        clicks: Math.floor(Math.random() * 500) + 50,
        valid: Math.floor(Math.random() * 300) + 20,
      });
    }
    return data;
  },

  createTask: async (task: Task) => {
    const taskWithId = { ...task };
    if (!taskWithId.id) {
        taskWithId.id = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    if (!taskWithId.status) {
        taskWithId.status = TaskStatus.ACTIVE;
    }
    MOCK_TASKS.unshift(taskWithId);
    saveData();
  },

  updateTask: async (task: Task) => {
    const index = MOCK_TASKS.findIndex(t => t.id === task.id);
    if (index !== -1) {
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

  getAffiliates: async () => {
    return MOCK_AFFILIATES;
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
  }
};