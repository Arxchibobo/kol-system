import React, { useState, useEffect, useCallback } from 'react';
import { User, Task, AffiliateTask, Tier, TIER_RATES, WithdrawalStatus, Notification } from '../types';
import { MockStore } from '../services/mockStore';
import { LayoutGrid, Target, Award, DollarSign, ExternalLink, Copy, CheckCircle, BarChart3, Settings as SettingsIcon, Play, Loader2, X, ChevronRight, AlertCircle, Trash2, RefreshCw, Wallet, Bell } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { TaskGuideModal } from './TaskGuideModal';
import { NewTaskAlert } from './NewTaskAlert';
import { WelcomeModal } from './WelcomeModal';

interface Props {
  user: User;
  onLogout?: () => void; // 添加登出回调函数
}

type Tab = 'DASHBOARD' | 'MARKET' | 'MY_TASKS' | 'WITHDRAWALS' | 'PROFILE';

export const AffiliateDashboard: React.FC<Props> = ({ user: initialUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  const [dashboardUser, setDashboardUser] = useState<User>(initialUser); // Local user state for live updates
  const [allTasks, setAllTasks] = useState<Task[]>([]); // Store all tasks for lookup
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<AffiliateTask[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 任务指引弹窗状态
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideModalTask, setGuideModalTask] = useState<Task | null>(null);

  // 新任务提醒弹窗状态
  const [showNewTaskAlert, setShowNewTaskAlert] = useState(false);
  const [newTasksCount, setNewTasksCount] = useState(0);

  // 欢迎提示弹窗状态
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // 提现弹窗状态
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalTask, setWithdrawalTask] = useState<AffiliateTask | null>(null);
  const [withdrawalForm, setWithdrawalForm] = useState({
    paymentMethod: 'PayPal',
    paymentDetails: ''
  });

  // 提现记录
  const [myWithdrawals, setMyWithdrawals] = useState<any[]>([]);

  // 通知系统状态
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // 🔧 新增：多链接管理状态 - 为每个任务维护链接数组
  const [taskPostLinks, setTaskPostLinks] = useState<Record<string, string[]>>({});

  const { t } = useLanguage();
  const { theme } = useTheme();

  const loadData = useCallback(async () => {
    try {
      // 1. 获取最新用户数据（包含统计数据和资料数据）
      const refreshedUser = await MockStore.login(initialUser.email);
      if (refreshedUser) {
          setDashboardUser(refreshedUser);
          // 同步更新 profileData 状态，确保 Profile 页面显示最新数据
          setProfileData({
              followerCount: refreshedUser.followerCount || 0,
              walletAddress: refreshedUser.walletAddress || '',
              socialLinks: {
                  twitter: refreshedUser.socialLinks?.twitter || '',
                  instagram: refreshedUser.socialLinks?.instagram || '',
                  youtube: refreshedUser.socialLinks?.youtube || '',
                  tiktok: refreshedUser.socialLinks?.tiktok || '',
                  linkedin: refreshedUser.socialLinks?.linkedin || '',
                  reddit: refreshedUser.socialLinks?.reddit || '',
                  facebook: refreshedUser.socialLinks?.facebook || '',
                  twitch: refreshedUser.socialLinks?.twitch || '',
                  discord: refreshedUser.socialLinks?.discord || ''
              }
          });
      }

      // 2. Fetch Tasks and Stats
      const t = await MockStore.getTasks(initialUser.role);
      console.log('[Affiliate] Fetched all tasks:', t.length, t);
      const mt = await MockStore.getMyTasks(initialUser.id);
      console.log('[Affiliate] My tasks:', mt.length, mt);
      const s = await MockStore.getStats(initialUser.id, initialUser.role);

    // 3. 从后端 API 获取每个任务的真实点击统计
    const updatedMyTasks = await Promise.all(
        mt.map(async (task) => {
            try {
                const statsRes = await fetch(`/api/stats/affiliate/${initialUser.id}/task/${task.taskId}`);
                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    console.log(`[Frontend] Fetched task ${task.taskId} click stats:`, stats);

                    // 计算预估收益 - 根据任务配置和用户等级
                    const userTier = refreshedUser?.tier || Tier.CORE_PARTNER;
                    const taskData = t.find(tsk => tsk.id === task.taskId);
                    let rate = TIER_RATES[userTier] || 50; // 🔧 修复：默认使用 50 防止 undefined
                    if (taskData?.isSpecialReward && taskData?.specialRewards) {
                        rate = taskData.specialRewards[userTier] || rate; // 🔧 修复：如果特殊奖励未定义，使用默认 rate
                    }
                    // 🔧 修复：防止 NaN，确保数值有效
                    const validClicks = stats.totalClicks || 0;
                    const validRate = isNaN(rate) ? 50 : rate;
                    const estimatedEarnings = (validClicks * validRate) / 1000;

                    return {
                        ...task,
                        stats: {
                            totalClicks: stats.totalClicks || 0,
                            validClicks: stats.validClicks || 0,
                            conversionRate: stats.totalClicks > 0 ? stats.validClicks / stats.totalClicks : 0,
                            estimatedEarnings: estimatedEarnings
                        }
                    };
                } else {
                    console.warn(`[Frontend] Failed to fetch task ${task.taskId} stats, using defaults`);
                    return task;
                }
            } catch (error) {
                console.error(`[Frontend] Error fetching task ${task.taskId} stats:`, error);
                return task;
            }
        })
    );

    // Filter out tasks already claimed
    const claimedIds = new Set(mt.map(i => i.taskId));
    const available = t.filter(task => !claimedIds.has(task.id) && task.status === 'ACTIVE');
    console.log('[Affiliate] Claimed task IDs:', Array.from(claimedIds));
    console.log('[Affiliate] Available tasks:', available.length, available);

    // Filter out AffiliateTask entries where corresponding task has been deleted (fixes Unknown Task issue)
    const validTaskIds = new Set(t.map(task => task.id));
    const validMyTasks = updatedMyTasks.filter(at => {
      const exists = validTaskIds.has(at.taskId);
      if (!exists) {
        console.warn(`[Affiliate] ⚠️  Filtered out deleted task: ${at.taskId}`);
      }
      return exists;
    });

    setAllTasks(t);
    setAvailableTasks(available);
    setMyTasks(validMyTasks); // Use filtered list
    setStats(s);

      // 4. Fetch my withdrawal records
      const withdrawals = await MockStore.getAffiliateWithdrawals(initialUser.id);
      setMyWithdrawals(withdrawals);
      console.log('[Affiliate] Withdrawal records:', withdrawals.length, withdrawals);

      // 5. Fetch notifications and unread count
      const notifs = await MockStore.getNotifications(initialUser.id);
      const unread = await MockStore.getUnreadNotificationCount(initialUser.id);
      setNotifications(notifs);
      setUnreadCount(unread);
      console.log('[Affiliate] Notifications:', notifs.length, 'Unread:', unread);

      // 6. 检测新任务并显示提醒
      if (refreshedUser) {
        const lastSeen = refreshedUser.lastSeenTaskTimestamp || '1970-01-01';
        const newTasks = available.filter(task => task.createdAt > lastSeen);

        // If there are new tasks and user has notifications enabled and no alert is currently shown, display alert
        if (newTasks.length > 0 && refreshedUser.notificationSettings?.newTaskAlert !== false && !showNewTaskAlert) {
          setNewTasksCount(newTasks.length);
          setShowNewTaskAlert(true);
          console.log(`[Frontend] Detected ${newTasks.length} new tasks, showing alert`);
        }
      }
    } catch (error) {
      console.error('[Frontend] Failed to load data:', error);
      // Silent failure, doesn't affect UI
    }
  }, [initialUser, showNewTaskAlert]);

  useEffect(() => {
    loadData();
  }, [loadData, activeTab]);

  // 检查是否首次登录，如果是则显示欢迎弹窗
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(`myshell_welcome_seen_${initialUser.id}`);
    if (!hasSeenWelcome) {
      // 延迟500ms显示，让用户先看到界面
      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 500);
    }
  }, [initialUser.id]);

  // Real-time sync: auto-refresh data every 5 seconds (includes new task detection)
  useEffect(() => {
    console.log('🔄 [Affiliate] Starting auto-sync, refreshing every 5 seconds');

    // Set interval timer to refresh every 5 seconds
    const intervalId = setInterval(() => {
      console.log('⏰ [Affiliate] Auto-refreshing data and detecting new tasks...');
      loadData();
    }, 5000); // 5 seconds for more timely new task alerts

    // Cleanup interval
    return () => {
      console.log('🛑 [Affiliate] Stopping auto-sync');
      clearInterval(intervalId);
    };
  }, [loadData]); // Depend on loadData to ensure we use the latest function

  // 🔧 修复：使用 useEffect 初始化链接，但避免循环依赖
  useEffect(() => {
    if (myTasks.length > 0) {
      setTaskPostLinks(prev => {
        const newLinks = { ...prev };
        let hasChanges = false;

        myTasks.forEach(task => {
          if (!newLinks[task.id]) {
            const existingLinks = task.submittedPostLink
              ? task.submittedPostLink.split('\n').filter(l => l.trim())
              : [];
            newLinks[task.id] = existingLinks.length > 0 ? existingLinks : [''];
            hasChanges = true;
          }
        });

        return hasChanges ? newLinks : prev;
      });
    }
  }, [myTasks.map(t => t.id).join(',')]); // 仅依赖任务 ID 列表

  // 点击 "Confirm & Claim" 按钮 - 先显示任务指引
  const handleConfirmClaim = (task: Task) => {
    // 关闭任务详情模态框
    setSelectedTask(null);

    // 显示任务指引弹窗
    setGuideModalTask(task);
    setShowGuideModal(true);
  };

  // 任务指引确认后 - 执行实际的领取操作
  const handleGuideComplete = async () => {
    if (!guideModalTask) return;

    try {
      // 执行领取任务
      await MockStore.claimTask(dashboardUser.id, guideModalTask);

      // 关闭指引弹窗
      setShowGuideModal(false);
      setGuideModalTask(null);

      // 跳转到 My Tasks 页面
      setActiveTab('MY_TASKS');

      // 重新加载数据以确保状态同步（不阻塞UI）
      loadData().catch(err => {
        console.error('[Frontend] Claimed successfully but failed to refresh data:', err);
      });
    } catch (error: any) {
      console.error('[Frontend] Failed to claim task:', error);

      // 关闭指引弹窗
      setShowGuideModal(false);
      setGuideModalTask(null);

      // 显示错误信息
      const errorMessage = error?.message || '领取任务失败，请重试';
      alert(errorMessage);
    }
  };

  // 查看新任务
  const handleViewNewTasks = async () => {
    setShowNewTaskAlert(false);
    setActiveTab('MARKET');
    // 更新最后查看时间戳
    await MockStore.updateLastSeenTaskTimestamp(dashboardUser.id);
  };

  // 关闭新任务提醒
  const handleDismissNewTaskAlert = () => {
    setShowNewTaskAlert(false);
  };

  // 关闭欢迎弹窗
  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    localStorage.setItem(`myshell_welcome_seen_${dashboardUser.id}`, 'true');
  };
  
  const handleGiveUp = async (affTaskId: string) => {
      if (window.confirm('Are you sure you want to give up this task? This action cannot be undone.')) {
          try {
            await MockStore.releaseTask(affTaskId);
            alert('Task released successfully');
            // 重新加载数据以刷新可用任务列表
            await loadData();
          } catch (error: any) {
            console.error('[Frontend] Failed to give up task:', error);
            alert('Task release failed: ' + error.message);
          }
      }
  };

  // 获取任务的奖励金额（根据用户等级和任务配置）
  const getTaskRewardRate = (task: Task): number => {
    const userTier = dashboardUser.tier || Tier.CORE_PARTNER;

    // 如果任务有特殊奖励配置，使用特殊奖励
    if (task.isSpecialReward && task.specialRewards) {
      const specialReward = task.specialRewards[userTier];
      if (specialReward !== undefined && specialReward !== null) {
        return specialReward;
      }
    }

    // 否则使用默认等级奖励
    const defaultRate = TIER_RATES[userTier];
    return defaultRate !== undefined ? defaultRate : 50; // 确保总是返回一个数字，默认50
  };

  // 打开提现弹窗
  const handleOpenWithdrawal = (task: AffiliateTask) => {
    setWithdrawalTask(task);
    setShowWithdrawalModal(true);
  };

  // 提交提现申请
  const handleSubmitWithdrawal = async () => {
    if (!withdrawalTask) return;

    try {
      const taskDef = allTasks.find(t => t.id === withdrawalTask.taskId);
      await MockStore.createWithdrawalRequest({
        affiliateId: dashboardUser.id,
        affiliateName: dashboardUser.name,
        affiliateTaskId: withdrawalTask.id,
        taskTitle: taskDef?.title || 'Unknown Task',
        amount: withdrawalTask.stats.estimatedEarnings,
        paymentMethod: withdrawalForm.paymentMethod,
        paymentDetails: withdrawalForm.paymentDetails
      });

      alert('Withdrawal request submitted, please wait for review');
      setShowWithdrawalModal(false);
      setWithdrawalForm({ paymentMethod: 'PayPal', paymentDetails: '' });

      // 重新加载提现记录
      const withdrawals = await MockStore.getAffiliateWithdrawals(dashboardUser.id);
      setMyWithdrawals(withdrawals);
    } catch (error: any) {
      alert(error?.message || 'Withdrawal request failed, please try again');
    }
  };

  const handleSubmitLink = async (affTaskId: string, link: string) => {
    await MockStore.submitPost(affTaskId, link);
    const updated = await MockStore.getMyTasks(dashboardUser.id);
    setMyTasks(updated);
  };

  // 🔧 新增：多链接管理函数
  // 添加新的链接输入框
  const addPostLink = (taskId: string) => {
    setTaskPostLinks(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || ['']), '']
    }));
  };

  // 更新指定位置的链接
  const updatePostLink = (taskId: string, index: number, value: string) => {
    setTaskPostLinks(prev => {
      const links = [...(prev[taskId] || [''])];
      links[index] = value;
      return { ...prev, [taskId]: links };
    });
  };

  // 删除指定位置的链接
  const removePostLink = (taskId: string, index: number) => {
    setTaskPostLinks(prev => {
      const links = [...(prev[taskId] || [''])];
      // 至少保留一个输入框
      if (links.length > 1) {
        links.splice(index, 1);
      } else {
        links[0] = ''; // 清空最后一个
      }
      return { ...prev, [taskId]: links };
    });
  };

  // 保存所有链接到服务器
  const savePostLinks = async (affTaskId: string) => {
    const links = taskPostLinks[affTaskId] || [];
    // 过滤掉空链接
    const validLinks = links.filter(link => link.trim() !== '');
    // 调用 API 保存（需要修改 submitPost 支持多链接）
    await MockStore.submitPost(affTaskId, validLinks.join('\n')); // 暂时用换行符连接
    const updated = await MockStore.getMyTasks(dashboardUser.id);
    setMyTasks(updated);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // 刷新统计数据
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshStats = async () => {
    setRefreshing(true);
    loadData().catch(err => {
      console.error('[Frontend] Manual data refresh failed:', err);
    }).finally(() => {
      setTimeout(() => setRefreshing(false), 500);
    });
  };

  // 个人资料编辑状态
  const [profileData, setProfileData] = useState({
    followerCount: 0,
    walletAddress: '',
    socialLinks: {
      twitter: '',
      instagram: '',
      youtube: '',
      tiktok: '',
      linkedin: '',
      reddit: '',
      facebook: '',
      twitch: '',
      discord: ''
    }
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Feedback 状态
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // 加载用户资料时初始化
  useEffect(() => {
    // 防御性检查：确保 socialLinks 对象存在
    const safeSocialLinks = dashboardUser.socialLinks || {
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

    setProfileData({
      followerCount: dashboardUser.followerCount || 0,
      walletAddress: dashboardUser.walletAddress || '',
      socialLinks: {
        twitter: safeSocialLinks.twitter || '',
        instagram: safeSocialLinks.instagram || '',
        youtube: safeSocialLinks.youtube || '',
        tiktok: safeSocialLinks.tiktok || '',
        linkedin: safeSocialLinks.linkedin || '',
        reddit: safeSocialLinks.reddit || '',
        facebook: safeSocialLinks.facebook || '',
        twitch: safeSocialLinks.twitch || '',
        discord: safeSocialLinks.discord || ''
      }
    });
  }, [dashboardUser]);

  // 保存个人资料
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await fetch(`/api/user/profile/${dashboardUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerCount: profileData.followerCount,
          walletAddress: profileData.walletAddress,
          socialLinks: profileData.socialLinks,
          name: dashboardUser.name,
          email: dashboardUser.email,
          avatar: dashboardUser.avatar
        })
      });

      // 重新加载数据（不阻塞UI）
      loadData().catch(err => {
        console.error('[Frontend] Saved successfully but failed to refresh data:', err);
      });
      alert('Profile saved successfully');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Save failed, please try again');
    } finally {
      setSavingProfile(false);
    }
  };

  // 发送反馈
  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;

    setSendingFeedback(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dashboardUser.id,
          userName: dashboardUser.name,
          userEmail: dashboardUser.email,
          feedback: feedbackText,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        alert('Feedback sent successfully! Thank you for your input.');
        setFeedbackText('');
      } else {
        throw new Error('Failed to send feedback');
      }
    } catch (error) {
      console.error('Send feedback failed:', error);
      alert('Failed to send feedback. Please try again later.');
    } finally {
      setSendingFeedback(false);
    }
  };

  // 删除账户
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you absolutely sure you want to delete your account?\n\n' +
      'This action CANNOT be undone. All your data, earnings, and progress will be permanently deleted.\n\n' +
      'Type "DELETE" in the next prompt to confirm.'
    );

    if (!confirmed) return;

    const confirmText = window.prompt('Please type "DELETE" to confirm account deletion:');

    if (confirmText !== 'DELETE') {
      alert('Account deletion cancelled. The confirmation text did not match.');
      return;
    }

    try {
      console.log(`[Affiliate] Deleting account: ${dashboardUser.id}`);

      // Call backend API to delete account (includes database and localStorage)
      const response = await fetch(`/api/user/${dashboardUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log('[Affiliate] Account deletion successful, clearing local data');

        // 清除所有本地存储的数据
        localStorage.removeItem('myshell_user');
        localStorage.removeItem('myshell_affiliates');
        localStorage.removeItem('myshell_aff_tasks');

        alert('Your account has been successfully deleted. You will be logged out now.');

        // 使用 onLogout 回调函数正确登出
        if (onLogout) {
          onLogout();
        } else {
          // 如果没有 onLogout 回调，强制刷新页面回到登录页
          window.location.href = '/';
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete account');
      }
    } catch (error: any) {
      console.error('[Affiliate] Account deletion failed:', error);
      alert('Failed to delete account: ' + (error.message || 'Unknown error. Please contact support at bobo@myshell.ai'));
    }
  };

  // 通知处理函数
  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try {
      await MockStore.markNotificationAsRead(notificationId);
      // 更新本地状态
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      await MockStore.markAllNotificationsAsRead(dashboardUser.id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };


  // 渲染通知面板
  const renderNotificationPanel = () => {
    if (!showNotificationPanel) return null;

    return (
      <div className="fixed top-20 right-4 w-96 max-h-[600px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-slate-600 dark:text-slate-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">通知中心</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllNotificationsAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                全部已读
              </button>
            )}
            <button
              onClick={() => setShowNotificationPanel(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* 通知列表 */}
        <div className="overflow-y-auto max-h-[500px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">暂无通知</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) {
                      handleMarkNotificationAsRead(notification.id);
                    }
                  }}
                  className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-full ${
                      notification.type === 'WITHDRAWAL_COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      notification.type === 'WITHDRAWAL_PROCESSING' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                      notification.type === 'WITHDRAWAL_REJECTED' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      {notification.type === 'WITHDRAWAL_COMPLETED' ? <CheckCircle size={16} /> :
                       notification.type === 'WITHDRAWAL_PROCESSING' ? <Loader2 size={16} /> :
                       notification.type === 'WITHDRAWAL_REJECTED' ? <X size={16} /> :
                       <Bell size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-slate-900 dark:text-white text-sm">
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(notification.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNav = () => (
    <div className="flex space-x-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit mb-8 transition-colors">
        {[
            { id: 'DASHBOARD', icon: LayoutGrid, label: t('affiliate.dashboard') },
            { id: 'MARKET', icon: Target, label: t('affiliate.market') },
            { id: 'MY_TASKS', icon: BarChart3, label: t('affiliate.myTasks') },
            { id: 'WITHDRAWALS', icon: Wallet, label: '提现记录' },
            { id: 'PROFILE', icon: SettingsIcon, label: t('affiliate.profile') },
        ].map((item) => (
            <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === item.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
                <item.icon size={16} /> {item.label}
            </button>
        ))}
    </div>
  );

  const renderDashboard = () => {
    const tierKey = `admin.tier${dashboardUser.tier ? dashboardUser.tier.charAt(0).toUpperCase() + dashboardUser.tier.slice(1).toLowerCase() : 'Bronze'}`;
    
    return (
    <div className="space-y-8">
        {/* Tier Status Card */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 p-8 rounded-2xl border border-slate-700 relative overflow-hidden shadow-xl">
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-slate-400 font-medium mb-1">{t('affiliate.currentTier')}</h2>
                    <div className={`text-4xl font-bold flex items-center gap-3 ${dashboardUser.tier === Tier.GOLD ? 'text-yellow-400' : dashboardUser.tier === Tier.SILVER ? 'text-slate-200' : 'text-amber-600'}`}>
                        <Award size={36} /> 
                        {t(tierKey)}
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        {t('affiliate.earnRate', { rate: TIER_RATES[dashboardUser.tier || Tier.CORE_PARTNER] })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-sm">{t('affiliate.nextSettlement')}</p>
                    <p className="text-2xl font-bold text-white mb-2">${dashboardUser.pendingEarnings?.toFixed(2) || '0.00'}</p>
                    {/* 提现门槛提示 */}
                    {(dashboardUser.pendingEarnings || 0) < 50 && (
                        <div className="mb-2 text-xs text-amber-400 flex items-center gap-1">
                            <AlertCircle size={12} />
                            <span>还需 ${(50 - (dashboardUser.pendingEarnings || 0)).toFixed(2)} 达到提现门槛</span>
                        </div>
                    )}
                    <button
                        disabled={(dashboardUser.pendingEarnings || 0) < 50}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                            (dashboardUser.pendingEarnings || 0) >= 50
                                ? 'bg-white text-slate-900 hover:bg-slate-200'
                                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        }`}
                        title={(dashboardUser.pendingEarnings || 0) < 50 ? '最低提现金额为 $50' : ''}
                    >
                        {t('affiliate.requestWithdrawal')}
                    </button>
                </div>
            </div>
        </div>

        {/* Stats Grid - Performance (Real-time) */}
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Performance (Real-time)</h3>
            <div className="flex items-center gap-3">
                <button
                    onClick={handleRefreshStats}
                    disabled={refreshing}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    title="Manual Refresh (Auto-refresh every 5s)"
                >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-colors">
                    <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {refreshing ? '同步中...' : '实时同步'}
                    </span>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm">{t('affiliate.totalClicks')}</h3>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{dashboardUser.totalClicks?.toLocaleString() ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm">{t('affiliate.validClicks')}</h3>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{dashboardUser.validClicks?.toLocaleString() ?? 0}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                        style={{width: `${dashboardUser.totalClicks ? Math.min(100, ((dashboardUser.validClicks || 0) / dashboardUser.totalClicks) * 100) : 0}%`}}
                    ></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {dashboardUser.totalClicks ? Math.round(((dashboardUser.validClicks || 0) / dashboardUser.totalClicks) * 100) : 0}% {t('affiliate.qualityScore')}
                </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                <h3 className="text-slate-500 dark:text-slate-400 text-sm">{t('affiliate.totalEarnings')}</h3>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">${dashboardUser.totalEarnings?.toFixed(2) ?? '0.00'}</p>
            </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 h-72 transition-colors">
             <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-white">{t('affiliate.clickPerformance')}</h3>
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats}>
                    <defs>
                        <linearGradient id="colorValidAff" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                            borderColor: theme === 'dark' ? '#1e293b' : '#e2e8f0', 
                            color: theme === 'dark' ? '#f8fafc' : '#0f172a' 
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                    />
                    <Area type="monotone" dataKey="valid" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorValidAff)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
  };

  const renderMarket = () => {
    // 判断任务是否为新任务
    const isNewTask = (task: Task) => {
      const lastSeen = dashboardUser.lastSeenTaskTimestamp || '1970-01-01';
      return task.createdAt > lastSeen;
    };

    return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableTasks.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-500 dark:text-slate-400">
                {t('affiliate.noTasks')}
            </div>
        )}
        {availableTasks.map(task => (
            <div key={task.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition-colors group shadow-sm dark:shadow-none relative">
                {/* 新任务徽章 */}
                {isNewTask(task) && (
                  <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    NEW
                  </span>
                )}
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded uppercase">{t('affiliate.new')}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{new Date(task.deadline).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">{task.description}</p>
                    
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-slate-700 dark:text-slate-300">
                                <DollarSign size={14} className="mr-2 text-emerald-600 dark:text-emerald-400"/>
                                <span>您的奖励</span>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    ${getTaskRewardRate(task)}<span className="text-xs text-slate-500">/1000 clicks</span>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {dashboardUser.tier === Tier.OFFICIAL_COLLABORATOR ? '官方合作者' :
                                     dashboardUser.tier === Tier.PREMIUM_INFLUENCER ? '高级影响者' :
                                     '核心伙伴'} 等级
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                            <Target size={14} className="mr-2 text-indigo-600 dark:text-indigo-400"/> {t('affiliate.requirements', { count: task.requirements?.length || 0 })}
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={() => setSelectedTask(task)}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white text-slate-900 dark:text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {t('affiliate.viewDetails')} <ExternalLink size={16} />
                </button>
            </div>
        ))}
    </div>
    );
  };

  const renderMyTasks = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('affiliate.myTasks')}</h2>
            <div className="flex items-center gap-3">
                <button
                    onClick={handleRefreshStats}
                    disabled={refreshing}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    title="Manual Refresh (Auto-refresh every 5s)"
                >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-colors">
                    <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {refreshing ? '同步中...' : '实时同步'}
                    </span>
                </div>
            </div>
        </div>

        {myTasks.length === 0 && (
             <div className="text-center py-20 text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                No tasks claimed yet. Go to the Market to find campaigns!
            </div>
        )}
        {myTasks.map(at => {
            const taskDef = allTasks.find(t => t.id === at.taskId) || { title: 'Unknown Task', description: '' }; 
            
            return (
                <div key={at.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors relative group">
                    {/* Give Up Button - 🔧 修复：改进可见性，始终显示按钮 */}
                    {at.status === 'CLAIMED' && (
                        <button
                            onClick={() => {
                                console.log('[Affiliate] Clicked give up task button:', at.id, 'Status:', at.status);
                                handleGiveUp(at.id);
                            }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-600"
                            title="Release Task"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    {/* 🔧 调试信息：显示任务状态 */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="absolute top-4 left-4 text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            状态: {at.status}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{taskDef.title}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${at.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                    {at.status}
                                </span>
                            </div>
                            
                            {/* Tracking Link Section */}
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 mb-4 transition-colors">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">{t('affiliate.trackingLink')}</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            readOnly
                                            value={at.uniqueTrackingLink}
                                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-indigo-600 dark:text-indigo-400 text-sm font-mono w-full focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <a
                                            href={at.uniqueTrackingLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                                            title="Open Link"
                                        >
                                            <ExternalLink size={16} />
                                            <span className="hidden sm:inline">Open</span>
                                        </a>
                                        <button
                                            onClick={() => copyToClipboard(at.uniqueTrackingLink)}
                                            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                                            title="Copy Link"
                                        >
                                            {copiedLink === at.uniqueTrackingLink ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                            <span className="hidden sm:inline">{copiedLink === at.uniqueTrackingLink ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">
                                    {t('affiliate.redirectNote')}
                                </p>
                            </div>

                            {/* 🔧 修改：支持多个推文链接 */}
                            <div className="mb-4">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">{t('affiliate.proofOfWork')}</label>
                                {(() => {
                                    // 🔧 修复：不在渲染时更新状态，直接使用已初始化的状态
                                    const links = taskPostLinks[at.id] || [''];

                                    return (
                                        <div className="space-y-2">
                                            {links.map((link, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="url"
                                                        value={link}
                                                        onChange={(e) => updatePostLink(at.id, index, e.target.value)}
                                                        placeholder={`${t('affiliate.pasteLink')} (optional)`}
                                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 flex-1 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none transition-colors"
                                                        disabled={at.status === 'VERIFIED'}
                                                    />
                                                    {at.status !== 'VERIFIED' && links.length > 1 && (
                                                        <button
                                                            onClick={() => removePostLink(at.id, index)}
                                                            className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                            title="Remove link"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <div className="flex gap-2">
                                                {at.status !== 'VERIFIED' && (
                                                    <button
                                                        onClick={() => addPostLink(at.id)}
                                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
                                                    >
                                                        + Add Another Link
                                                    </button>
                                                )}
                                                {at.status !== 'VERIFIED' && (
                                                    <button
                                                        onClick={() => savePostLinks(at.id)}
                                                        className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded"
                                                    >
                                                        {t('common.save')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Stats Mini-Dashboard */}
                        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-center space-y-4 transition-colors">
                             <div>
                                <p className="text-xs text-slate-500">{t('affiliate.clicksGenerated')}</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{at.stats.totalClicks.toLocaleString()}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500">{t('affiliate.estEarnings')}</p>
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${(at.stats.estimatedEarnings || 0).toFixed(2)}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500">{t('affiliate.conversion')}</p>
                                <p className="text-sm font-mono text-slate-600 dark:text-slate-300">{(at.stats.conversionRate * 100).toFixed(1)}%</p>
                             </div>

                             {/* Withdrawal Button */}
                             {at.submittedPostLink && at.stats.estimatedEarnings >= 50 && (
                                 <button
                                     onClick={() => handleOpenWithdrawal(at)}
                                     className="w-full mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                 >
                                     <DollarSign size={16} />
                                     申请提现
                                 </button>
                             )}
                             {at.submittedPostLink && at.stats.estimatedEarnings < 50 && (
                                 <p className="text-xs text-slate-500 text-center mt-2">
                                     最低提现金额: $50
                                 </p>
                             )}
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white">{t('common.welcome')}, {dashboardUser.name}</h1>
            <p className="text-slate-500 dark:text-slate-400">Track your impact and grow your earnings.</p>
        </div>
        <div className="flex items-center gap-4">
          {/* 通知铃铛 */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationPanel(!showNotificationPanel)}
              className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <Bell size={20} className="text-slate-600 dark:text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('affiliate.systemOperational')}</span>
          </div>
        </div>
      </div>

      {/* 通知面板 */}
      {renderNotificationPanel()}

      {renderNav()}

      {activeTab === 'DASHBOARD' && renderDashboard()}
      {activeTab === 'MARKET' && renderMarket()}
      {activeTab === 'MY_TASKS' && renderMyTasks()}
      {activeTab === 'WITHDRAWALS' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">我的提现记录</h2>

          {myWithdrawals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
              <Wallet size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">暂无提现记录</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">完成任务并达到最低提现金额后即可申请提现</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myWithdrawals.map((withdrawal: any) => (
                <div key={withdrawal.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white">{withdrawal.taskTitle}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          withdrawal.status === WithdrawalStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          withdrawal.status === WithdrawalStatus.PROCESSING ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          withdrawal.status === WithdrawalStatus.REJECTED ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {withdrawal.status === WithdrawalStatus.COMPLETED ? '已完成' :
                           withdrawal.status === WithdrawalStatus.PROCESSING ? '处理中' :
                           withdrawal.status === WithdrawalStatus.REJECTED ? '已拒绝' : '待审核'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">提现金额</p>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${withdrawal.amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">收款方式</p>
                          <p className="text-slate-900 dark:text-white">{withdrawal.paymentMethod}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">申请时间</p>
                          <p className="text-slate-900 dark:text-white">{new Date(withdrawal.requestedAt).toLocaleString('zh-CN')}</p>
                        </div>
                        {withdrawal.completedAt && (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">完成时间</p>
                            <p className="text-slate-900 dark:text-white">{new Date(withdrawal.completedAt).toLocaleString('zh-CN')}</p>
                          </div>
                        )}
                      </div>

                      {withdrawal.status === WithdrawalStatus.REJECTED && withdrawal.adminNotes && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                          <p className="text-xs text-red-700 dark:text-red-400 font-medium mb-1">拒绝原因：</p>
                          <p className="text-sm text-red-800 dark:text-red-300">{withdrawal.adminNotes}</p>
                        </div>
                      )}

                      {withdrawal.status === WithdrawalStatus.COMPLETED && withdrawal.paymentProof && (
                        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-2">✓ 已打款</p>
                          <a
                            href={withdrawal.paymentProof}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            查看付款截图 <ExternalLink size={14} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'PROFILE' && (
          <div className="max-w-4xl space-y-6">
              <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">{t('affiliate.profileSettings')}</h2>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-8 transition-colors">
                  {/* Basic Information Section */}
                  <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Basic Information</h3>

                      <div>
                          <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('affiliate.displayName')}</label>
                          <input type="text" value={dashboardUser.name} readOnly className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-500 cursor-not-allowed" />
                      </div>

                      <div>
                          <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                              Follower Count
                              <span className="ml-2 text-xs text-slate-400">(Editable)</span>
                          </label>
                          <input
                              type="number"
                              value={profileData.followerCount}
                              onChange={(e) => setProfileData({...profileData, followerCount: parseInt(e.target.value) || 0})}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                              placeholder="Enter follower count"
                          />
                      </div>

                      <div>
                          <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('affiliate.walletAddress')}</label>
                          <input
                              type="text"
                              value={profileData.walletAddress}
                              onChange={(e) => setProfileData({...profileData, walletAddress: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                              placeholder="Enter USDT wallet address"
                          />
                      </div>
                  </div>

                  {/* Social Media Links Section */}
                  <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Social Media Links</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Twitter/X */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  Twitter / X URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.twitter}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, twitter: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://twitter.com/username"
                              />
                          </div>

                          {/* Instagram */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  Instagram URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.instagram}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, instagram: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://instagram.com/username"
                              />
                          </div>

                          {/* YouTube */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  YouTube URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.youtube}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, youtube: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://youtube.com/@username"
                              />
                          </div>

                          {/* TikTok */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  TikTok URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.tiktok}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, tiktok: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://tiktok.com/@username"
                              />
                          </div>

                          {/* LinkedIn */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  LinkedIn URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.linkedin}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, linkedin: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://linkedin.com/in/username"
                              />
                          </div>

                          {/* Reddit */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  Reddit URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.reddit}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, reddit: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://reddit.com/user/username"
                              />
                          </div>

                          {/* Facebook */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  Facebook URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.facebook}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, facebook: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://facebook.com/username"
                              />
                          </div>

                          {/* Twitch */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  Twitch URL
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.twitch}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, twitch: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="https://twitch.tv/username"
                              />
                          </div>

                          {/* Discord */}
                          <div>
                              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                                  Discord Username
                              </label>
                              <input
                                  type="text"
                                  value={profileData.socialLinks.discord}
                                  onChange={(e) => setProfileData({...profileData, socialLinks: {...profileData.socialLinks, discord: e.target.value}})}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="username#1234"
                              />
                          </div>
                      </div>
                  </div>

                  {/* 通知设置部分 */}
                  <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                          Notification Settings
                      </h3>

                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                          <div>
                              <label className="text-sm font-medium text-slate-900 dark:text-white block mb-1">
                                  New Task Alerts
                              </label>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Notify me when new tasks are published
                              </p>
                          </div>
                          <input
                              type="checkbox"
                              checked={dashboardUser.notificationSettings?.newTaskAlert !== false}
                              onChange={async (e) => {
                                  const newSettings = { newTaskAlert: e.target.checked };
                                  await MockStore.updateNotificationSettings(dashboardUser.id, newSettings);
                                  const updatedUser = await MockStore.login(dashboardUser.email);
                                  if (updatedUser) {
                                      setDashboardUser(updatedUser);
                                  }
                              }}
                              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 focus:ring-2"
                          />
                      </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                          onClick={handleSaveProfile}
                          disabled={savingProfile}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                          {savingProfile ? (
                              <>
                                  <RefreshCw size={16} className="animate-spin" />
                                  Saving...
                              </>
                          ) : (
                              t('affiliate.saveChanges')
                          )}
                      </button>
                  </div>
              </div>

              {/* Feedback Section */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-6 transition-colors">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Feedback</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                      Have suggestions or found an issue? Let us know!
                  </p>
                  <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Your Feedback</label>
                      <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 min-h-[120px] resize-y"
                          placeholder="Tell us what you think or report any issues..."
                      />
                  </div>
                  <button
                      onClick={handleSendFeedback}
                      disabled={sendingFeedback || !feedbackText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                      {sendingFeedback ? (
                          <>
                              <RefreshCw size={16} className="animate-spin" />
                              Sending...
                          </>
                      ) : (
                          <>
                              <AlertCircle size={16} />
                              Send Feedback
                          </>
                      )}
                  </button>
              </div>

              {/* Danger Zone - Delete Account */}
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-8 space-y-4 transition-colors">
                  <h2 className="text-xl font-bold text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800 pb-2">Danger Zone</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                      Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <button
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                  >
                      <Trash2 size={16} />
                      Delete My Account
                  </button>
              </div>
          </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0 rounded-2xl w-full max-w-2xl relative transition-colors shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedTask.title}</h3>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                                <DollarSign size={16} className="mr-1"/> {t('affiliate.baseReward', { rate: selectedTask.rewardRate || 0 })}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                                Deadline: {new Date(selectedTask.deadline).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertCircle size={16} /> {t('affiliate.aboutCampaign')}
                        </h4>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                            {selectedTask.description}
                        </p>
                    </div>
                    
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Target size={16} /> {t('affiliate.campaignReqs')}
                        </h4>
                        <ul className="space-y-2">
                            {(selectedTask.requirements || []).map((req, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                    {req}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                    <button 
                        onClick={() => setSelectedTask(null)}
                        className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => handleConfirmClaim(selectedTask)}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {t('affiliate.confirmClaim')} <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 任务指引弹窗 */}
      {showGuideModal && guideModalTask && (
        <TaskGuideModal
          isOpen={showGuideModal}
          taskTitle={guideModalTask.title}
          onComplete={handleGuideComplete}
        />
      )}

      {/* 新任务提醒弹窗 */}
      {showNewTaskAlert && (
        <NewTaskAlert
          isOpen={showNewTaskAlert}
          taskCount={newTasksCount}
          onViewTasks={handleViewNewTasks}
          onDismiss={handleDismissNewTaskAlert}
        />
      )}

      {/* 欢迎提示弹窗 */}
      {showWelcomeModal && (
        <WelcomeModal
          isOpen={showWelcomeModal}
          userName={dashboardUser.name}
          onClose={handleCloseWelcome}
        />
      )}

      {/* Withdrawal Modal */}
      {showWithdrawalModal && withdrawalTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWithdrawalModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">申请提现</h2>
              <button onClick={() => setShowWithdrawalModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">任务</p>
                <p className="font-medium text-slate-900 dark:text-white">{allTasks.find(t => t.id === withdrawalTask.taskId)?.title}</p>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-1">提现金额</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${withdrawalTask.stats.estimatedEarnings.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">收款方式</label>
                <select
                  value={withdrawalForm.paymentMethod}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, paymentMethod: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PayPal">PayPal</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Crypto (USDT-TRC20)">Crypto (USDT-TRC20)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  收款账号
                  <span className="text-xs text-slate-500 ml-2">(邮箱/账号/地址)</span>
                </label>
                <input
                  type="text"
                  value={withdrawalForm.paymentDetails}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, paymentDetails: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Enter your wallet address"
                />
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-800 dark:text-yellow-400">
                  ⚠️ After submitting a withdrawal request, the operations team will process it within 1-3 business days. Please ensure your payment information is accurate.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawalModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmitWithdrawal}
                disabled={!withdrawalForm.paymentDetails}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-medium"
              >
                确认提现
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};