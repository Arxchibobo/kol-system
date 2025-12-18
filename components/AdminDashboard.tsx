import React, { useState, useEffect, useCallback } from 'react';
import { User, Task, TaskStatus, Tier, UserRole, TIER_RATES, WithdrawalRequest, WithdrawalStatus, ApprovalStatus } from '../types';
import { MockStore } from '../services/mockStore';
import { LayoutGrid, Plus, Users, DollarSign, Activity, Search, AlertTriangle, CheckCircle, BarChart3, FileText, RefreshCw, ChevronRight, Twitter, Youtube, ExternalLink, X, Wallet, Mail, Instagram, Award, Trash2, Upload, Settings as SettingsIcon, UserCheck, UserX } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { parseAndValidateCSV, generatePreviewData, getTierStats, getTagStats, ImportResult } from '../utils/csvImporter';
import { autoImportAllKOLs } from '../utils/autoImportKOLs';

interface Props {
  user: User;
}

type Tab = 'OVERVIEW' | 'TASKS' | 'AFFILIATES' | 'WITHDRAWALS' | 'APPROVAL';

export const AdminDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  // Overview Stats
  const [overviewData, setOverviewData] = useState({ totalClicks: 0, pendingPayout: 0, flaggedCount: 0 });

  // New Task / Edit Task Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    productLink: '',
    isSpecialReward: true, // 默认开启特殊奖励，让三个等级输入框始终显示
    specialRewards: {
      CORE_PARTNER: TIER_RATES[Tier.CORE_PARTNER],
      PREMIUM_INFLUENCER: TIER_RATES[Tier.PREMIUM_INFLUENCER],
      OFFICIAL_COLLABORATOR: TIER_RATES[Tier.OFFICIAL_COLLABORATOR]
    }
  });

  // Dedicated form states for complex fields
  const [formDeadline, setFormDeadline] = useState('');
  const [formRequirements, setFormRequirements] = useState('');

  // Affiliate Management State
  const [affiliates, setAffiliates] = useState<User[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 达人实时统计数据 (从数据库获取)
  const [creatorStats, setCreatorStats] = useState<Record<string, any>>({});

  // 异常预警状态
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);

  // 全局刷新状态
  const [refreshing, setRefreshing] = useState(false);

  // 自动审核规则配置
  const [showAutoReviewModal, setShowAutoReviewModal] = useState(false);
  const [autoReviewRules, setAutoReviewRules] = useState({
    enabled: false,
    minAmount: 50, // 最低自动通过金额
    maxAmount: 500, // 最高自动通过金额
    requireVerifiedAccount: true, // 需要验证过的账号
    minTasksCompleted: 3, // 至少完成3个任务
    blacklistCheck: true, // 黑名单检查
    autoApproveUnder: 100 // 小于此金额自动通过（如果满足其他条件）
  });

  // 任务参与者状态
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskParticipants, setTaskParticipants] = useState<Record<string, any[]>>({});

  // 标签分类系统 - Tag classification system
  const AVAILABLE_TAGS = ['AI Creator', 'Fashion', 'Lifestyle', 'Tech', 'Gaming', 'Food', 'Travel', 'Other'];
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All'); // 🔧 移到组件顶层，修复 React #310 错误

  // Manual Add KOL State
  const [showAddKolModal, setShowAddKolModal] = useState(false);
  const [newKol, setNewKol] = useState<Partial<User>>({
    name: '',
    email: '',
    tier: Tier.CORE_PARTNER,
    followerCount: 0,
    tags: [],
    socialLinks: { twitter: '', youtube: '', instagram: '', tiktok: '' }
  });

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);

  // 达人审核状态
  const [pendingAffiliates, setPendingAffiliates] = useState<User[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);

  const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1FrjSNSrNZTMgWl1dDBZIOTWQOgEO7An9UKNxUmRepG0/edit?gid=1698530545#gid=1698530545";

  // 获取真实的全局统计数据
  const fetchRealTotalStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/total-stats');
      if (response.ok) {
        const data = await response.json();
        setOverviewData(prev => ({ ...prev, totalClicks: data.totalClicks }));
      }
    } catch (error) {
      console.error('Failed to fetch total stats:', error);
    }
  }, []);

  // 获取异常预警数据
  const fetchAnomalies = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/anomalies');
      if (response.ok) {
        const data = await response.json();
        setAnomalies(data);
        setOverviewData(prev => ({ ...prev, flaggedCount: data.length }));
      }
    } catch (error) {
      console.error('Failed to fetch anomalies:', error);
    }
  }, []);

  // 全局刷新所有数据
  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const taskList = await MockStore.getTasks(user.role);
      console.log('[Admin] Fetched task list:', taskList.length, taskList);
      const s = await MockStore.getStats(user.id, user.role);
      const aff = await MockStore.getAffiliates();
      const ov = await MockStore.getAdminOverviewStats();
      const withdrawalList = await MockStore.getAllWithdrawals();
      const pending = await MockStore.getPendingAffiliates(); // 获取待审核达人

      setTasks(taskList);
      setStats(s);
      setAffiliates(aff);
      setOverviewData(ov);
      setWithdrawals(withdrawalList);
      setPendingAffiliates(pending);

      // 🔧 调试日志：显示待审核达人数量
      console.log('[Admin] 待审核达人数量:', pending.length, pending);

      // 获取真实数据
      await fetchRealTotalStats();
      await fetchAnomalies();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [user.role, user.id, fetchRealTotalStats, fetchAnomalies]); // 依赖于 user 和其他函数

  // Real-time sync: refresh immediately on component load, then auto-refresh every 10 seconds
  useEffect(() => {
    console.log('🔄 Starting auto-sync, refreshing every 10 seconds');

    // Refresh immediately
    handleRefreshAll();

    // Set interval timer to refresh every 10 seconds
    const intervalId = setInterval(() => {
      console.log('⏰ Auto-refreshing task list...');
      handleRefreshAll();
    }, 10000); // 10 seconds

    // Cleanup interval
    return () => {
      console.log('🛑 Stopping auto-sync');
      clearInterval(intervalId);
    };
  }, [handleRefreshAll]); // 依赖于 handleRefreshAll

  const openCreateModal = () => {
      setEditingTaskId(null);
      setNewTask({
        title: '',
        description: '',
        productLink: '',
        isSpecialReward: false,
        specialRewards: {
          CORE_PARTNER: TIER_RATES[Tier.CORE_PARTNER],
          PREMIUM_INFLUENCER: TIER_RATES[Tier.PREMIUM_INFLUENCER],
          OFFICIAL_COLLABORATOR: TIER_RATES[Tier.OFFICIAL_COLLABORATOR]
        }
      });

      // Default deadline: 30 days from now
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setFormDeadline(d.toISOString().split('T')[0]);
      setFormRequirements('');

      setShowCreateModal(true);
  };

  const handleEditClick = (task: Task) => {
      setEditingTaskId(task.id);
      setNewTask({ ...task });
      
      // Parse deadline
      try {
          setFormDeadline(new Date(task.deadline).toISOString().split('T')[0]);
      } catch (e) {
          setFormDeadline('');
      }
      
      // Parse requirements to multiline string
      setFormRequirements(task.requirements ? task.requirements.join('\n') : '');
      
      setShowCreateModal(true);
  };

  const handleSaveTask = async () => {
    if (!newTask.title) return;

    // Process deadline
    const deadlineISO = formDeadline ? new Date(formDeadline).toISOString() : new Date(Date.now() + 86400000 * 30).toISOString();
    
    // Process requirements
    const requirementsArray = formRequirements
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const taskData = {
        ...newTask,
        deadline: deadlineISO,
        requirements: requirementsArray.length > 0 ? requirementsArray : ['Standard Requirements']
    };

    if (editingTaskId) {
        // Update existing task
        await MockStore.updateTask({
            ...taskData as Task,
            id: editingTaskId,
        });
    } else {
        // Create new task
        const newId = `task-${Date.now()}`;
        await MockStore.createTask({
            ...taskData as Task,
            id: newId,
            status: TaskStatus.ACTIVE,
            createdAt: new Date().toISOString(),
        });
    }

    const updatedTasks = await MockStore.getTasks(user.role);
    setTasks([...updatedTasks]); // Force update
    setShowCreateModal(false);
    setEditingTaskId(null);
    setNewTask({
      title: '',
      description: '',
      productLink: '',
      isSpecialReward: false,
      specialRewards: {
        CORE_PARTNER: TIER_RATES[Tier.CORE_PARTNER],
        PREMIUM_INFLUENCER: TIER_RATES[Tier.PREMIUM_INFLUENCER],
        OFFICIAL_COLLABORATOR: TIER_RATES[Tier.OFFICIAL_COLLABORATOR]
      }
    });
  };

  const handleStopTask = async (taskId: string) => {
    // Removed confirmation for immediate toggle response
    await MockStore.stopTask(taskId);
    const updatedList = await MockStore.getTasks(user.role);
    setTasks([...updatedList]); // Ensure state update with new reference
  };

  const handleRestartTask = async (taskId: string) => {
    // Removed confirmation for immediate toggle response
    await MockStore.restartTask(taskId);
    const updatedList = await MockStore.getTasks(user.role);
    setTasks([...updatedList]); // Ensure state update with new reference
  };

  // 删除任务（级联删除所有相关数据）
  const handleDeleteTask = async (task: Task) => {
    // 第一层确认
    const confirmed = window.confirm(
      `Are you sure you want to delete task "${task.title}"?\n\n` +
      `This operation will:\n` +
      `1. Delete the task itself\n` +
      `2. Delete all affiliate claim records\n` +
      `3. Delete all related tracking links and click data (if exists)\n\n` +
      `This action cannot be undone!`
    );

    if (!confirmed) return;

    // 第二层确认：输入任务名称
    const confirmText = window.prompt(
      `Please enter the task name "${task.title}" to confirm deletion:`
    );

    if (confirmText !== task.title) {
      alert('Task name does not match, deletion cancelled');
      return;
    }

    try {
      // 1. Delete task from MockStore (localStorage)
      const mockResult = await MockStore.deleteTask(task.id);
      console.log('[Frontend] MockStore deletion successful:', mockResult);

      // 2. Also call backend API to clean up tracking data in database (if exists)
      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const dbResult = await response.json();
          console.log('[Backend] Database cleanup successful:', dbResult);
        } else {
          // Database deletion failure doesn't affect overall result (table may not exist)
          console.warn('[Backend] Database cleanup failed, but task removed from system');
        }
      } catch (dbError) {
        console.warn('[Backend] Database cleanup error, but task removed from system:', dbError);
      }

      // 3. Show success message and refresh list
      alert(`Task "${task.title}" deleted successfully!`);
      const updatedList = await MockStore.getTasks(user.role);
      setTasks([...updatedList]);

    } catch (error: any) {
      console.error('Task deletion error:', error);
      alert(`Deletion failed: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSyncKOLs = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
        const count = await MockStore.syncKOLs();
        const updatedList = await MockStore.getAffiliates();
        const ov = await MockStore.getAdminOverviewStats();
        setAffiliates(updatedList);
        setOverviewData(ov);
        setSyncMessage(t('admin.importedCount', { count }));
    } catch (e) {
        setSyncMessage(t('admin.importError'));
    } finally {
        setSyncing(false);
        setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const toggleRow = async (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
        newExpanded.delete(id);
    } else {
        newExpanded.add(id);
        // 当展开时,获取该达人的实时统计数据
        await fetchCreatorStats(id);
    }
    setExpandedRows(newExpanded);
  };

  // 获取达人的实时统计数据
  const fetchCreatorStats = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/creator-stats/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setCreatorStats(prev => ({ ...prev, [userId]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch creator stats:', error);
    }
  };

  const handleUpdateTier = async (affiliate: User, newTier: Tier) => {
      const updatedUser = { ...affiliate, tier: newTier };
      await MockStore.updateAffiliate(updatedUser);
      const updatedList = await MockStore.getAffiliates();
      setAffiliates(updatedList);
  };

  const handleAddKol = async () => {
    if (!newKol.name || !newKol.email) return;

    const userToAdd: User = {
        id: `manual-${Date.now()}`,
        name: newKol.name,
        email: newKol.email,
        role: UserRole.AFFILIATE,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newKol.name)}&background=random`,
        tier: newKol.tier as Tier,
        totalEarnings: 0,
        pendingEarnings: 0,
        totalClicks: 0,
        validClicks: 0,
        followerCount: newKol.followerCount,
        socialLinks: newKol.socialLinks,
        walletAddress: '',
        tags: newKol.tags || []
    };

    // 添加达人到 MockStore
    await MockStore.addAffiliate(userToAdd);

    // 保存标签到数据库
    if (newKol.tags && newKol.tags.length > 0) {
        await fetch(`/api/user/profile/${userToAdd.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                followerCount: newKol.followerCount,
                tags: newKol.tags,
                name: newKol.name,
                email: newKol.email,
                avatar: userToAdd.avatar
            })
        });
    }

    const updatedList = await MockStore.getAffiliates();
    const ov = await MockStore.getAdminOverviewStats();
    setAffiliates(updatedList);
    setOverviewData(ov);
    setShowAddKolModal(false);
    setSyncMessage(t('admin.addSuccess'));
    setTimeout(() => setSyncMessage(null), 3000);

    // Reset form
    setNewKol({
        name: '',
        email: '',
        tier: Tier.CORE_PARTNER,
        followerCount: 0,
        tags: [],
        socialLinks: { twitter: '', youtube: '', instagram: '', tiktok: '' }
    });
  };

  // CSV 导入处理函数
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImporting(true);

    try {
      const result = await parseAndValidateCSV(file);
      setImportResult(result);
      setShowImportPreview(true);
    } catch (error) {
      console.error('CSV parsing failed:', error);
      setSyncMessage('CSV parsing failed, please check file format');
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importResult || importResult.users.length === 0) return;

    setImporting(true);
    setSyncMessage(null);

    try {
      // 批量注册用户
      const result = await MockStore.batchRegister(importResult.users);

      // 刷新达人列表
      const updatedList = await MockStore.getAffiliates();
      setAffiliates(updatedList);

      // 更新概览数据
      const ov = await MockStore.getAdminOverviewStats();
      setOverviewData(ov);

      // Show success message
      setSyncMessage(`Import completed: ${result.success} successful, ${result.skipped} skipped`);
      setTimeout(() => setSyncMessage(null), 5000);

      // 关闭模态框
      setShowImportModal(false);
      setShowImportPreview(false);
      setImportFile(null);
      setImportResult(null);
    } catch (error) {
      console.error('Import failed:', error);
      setSyncMessage('Import failed, please try again');
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setShowImportModal(false);
    setShowImportPreview(false);
    setImportFile(null);
    setImportResult(null);
    setSyncMessage(null);
  };

  // 自动导入全部 KOL
  const handleAutoImportAll = async () => {
    setImporting(true);
    setSyncMessage('Auto-importing all KOLs...');

    try {
      // Read both CSV files
      const response1 = await fetch('/KOL_Export_2025-12-16.csv');
      const file1Content = await response1.text();

      const response2 = await fetch('/博主合作数据库 2933f81ff51e808cbc21e9c140005179.csv');
      const file2Content = await response2.text();

      // Parse and process
      const { users, stats } = await autoImportAllKOLs(file1Content, file2Content);

      console.log('📊 Import stats:', stats);

      // Batch register
      const result = await MockStore.batchRegister(users);

      // Refresh list
      const updatedList = await MockStore.getAffiliates();
      setAffiliates(updatedList);

      const ov = await MockStore.getAdminOverviewStats();
      setOverviewData(ov);

      // Show results
      setSyncMessage(`🎉 Auto-import completed!
        Total: ${stats.total} KOLs
        Successfully imported: ${result.success}
        Skipped duplicates: ${result.skipped}
        GOLD: ${stats.tierStats.gold} | SILVER: ${stats.tierStats.silver} | BRONZE: ${stats.tierStats.bronze}
        With email: ${stats.withEmail} | Without email: ${stats.withoutEmail}`);

      setTimeout(() => setSyncMessage(null), 10000);
    } catch (error) {
      console.error('Auto-import failed:', error);
      setSyncMessage(`❌ Auto-import failed: ${error}`);
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setImporting(false);
    }
  };

  // 批准达人
  const handleApproveAffiliate = async (userId: string) => {
    try {
      await MockStore.approveAffiliate(userId);
      // 刷新待审核列表
      const pending = await MockStore.getPendingAffiliates();
      setPendingAffiliates(pending);
      // 刷新全部达人列表
      const aff = await MockStore.getAffiliates();
      setAffiliates(aff);
      alert('Affiliate approved successfully!');
    } catch (error) {
      console.error('Failed to approve affiliate:', error);
      alert('Failed to approve affiliate');
    }
  };

  // 拒绝达人
  const handleRejectAffiliate = async (userId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      await MockStore.rejectAffiliate(userId, rejectionReason);
      // 刷新待审核列表
      const pending = await MockStore.getPendingAffiliates();
      setPendingAffiliates(pending);
      // 刷新全部达人列表
      const aff = await MockStore.getAffiliates();
      setAffiliates(aff);
      setRejectingUserId(null);
      setRejectionReason('');
      alert('Affiliate rejected');
    } catch (error) {
      console.error('Failed to reject affiliate:', error);
      alert('Failed to reject affiliate');
    }
  };

  // 切换任务参与者显示
  const handleToggleParticipants = async (taskId: string) => {
    const isExpanded = expandedTasks.has(taskId);

    if (isExpanded) {
      // 收起
      const newExpanded = new Set(expandedTasks);
      newExpanded.delete(taskId);
      setExpandedTasks(newExpanded);
    } else {
      // 展开并加载参与者
      const newExpanded = new Set(expandedTasks);
      newExpanded.add(taskId);
      setExpandedTasks(newExpanded);

      // 🔧 每次展开都重新加载参与者数据，确保数据最新
      try {
        console.log(`[Admin] 正在加载任务 ${taskId} 的参与者...`);
        const participants = await MockStore.getTaskParticipants(taskId);
        console.log(`[Admin] 任务 ${taskId} 的参与者:`, participants.length, participants);
        setTaskParticipants({
          ...taskParticipants,
          [taskId]: participants
        });
      } catch (error) {
        console.error('[Admin] 加载参与者失败:', error);
      }
    }
  };

  const renderNav = () => (
    <div className="flex space-x-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit mb-8 transition-colors">
        {[
            { id: 'OVERVIEW', icon: LayoutGrid, label: t('admin.overview') },
            { id: 'TASKS', icon: FileText, label: t('admin.tasks') },
            { id: 'AFFILIATES', icon: Users, label: t('admin.affiliates') },
            { id: 'WITHDRAWALS', icon: Wallet, label: 'Withdrawals' },
            { id: 'APPROVAL', icon: UserCheck, label: 'Affiliate Approval', badge: pendingAffiliates.length },
        ].map((item) => (
            <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                    activeTab === item.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
                <item.icon size={16} /> {item.label}
                {item.badge && item.badge > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {item.badge}
                    </span>
                )}
            </button>
        ))}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg"><Activity className="text-indigo-600 dark:text-indigo-400" size={24} /></div>
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Real-time</span>
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('admin.totalClicks')}</h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overviewData.totalClicks.toLocaleString()}</p>
                <div className="text-xs text-slate-500 mt-2">{t('admin.flaggedSuspicious', { count: overviewData.flaggedCount })}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg"><DollarSign className="text-purple-600 dark:text-purple-400" size={24} /></div>
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('admin.pendingPayout')}</h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">${overviewData.pendingPayout.toLocaleString()}</p>
                <div className="text-xs text-slate-500 mt-2">{t('admin.nextSettlementDate', { date: 'End of Month' })}</div>
            </div>
            <div
                onClick={() => setShowAnomaliesModal(true)}
                className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer hover:border-orange-500 dark:hover:border-orange-500"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg"><AlertTriangle className="text-orange-600 dark:text-orange-400" size={24} /></div>
                    <span className="text-xs font-mono text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded">{t('common.actionNeeded')}</span>
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('admin.flaggedActivities')}</h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overviewData.flaggedCount}</p>
                <button className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 hover:underline">查看详情 →</button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 h-80 transition-colors">
            <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-white">{t('admin.trafficTrend')}</h3>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats}>
                    <defs>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorValid" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                    <Area type="monotone" dataKey="clicks" stroke="#6366f1" fillOpacity={1} fill="url(#colorClicks)" />
                    <Area type="monotone" dataKey="valid" stroke="#10b981" fillOpacity={1} fill="url(#colorValid)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('admin.campaignManagement')}</h2>
            <button 
                onClick={openCreateModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
                <Plus size={16} /> {t('admin.createTask')}
            </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {tasks.map(task => {
                const isExpanded = expandedTasks.has(task.id);
                const participants = taskParticipants[task.id] || [];

                return (
                <div key={task.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors overflow-hidden">
                    <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{task.title}</h3>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${task.status === TaskStatus.ACTIVE ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                    {task.status}
                                </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl">{task.description}</p>
                            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                                <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                                {/* 参与者数量 */}
                                <button
                                    onClick={() => handleToggleParticipants(task.id)}
                                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <Users size={14} />
                                    <span>{participants.length} Participants</span>
                                    <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                         <button
                             onClick={() => handleEditClick(task)}
                             className="p-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                         >
                            {t('common.edit')}
                         </button>

                         {/* 删除按钮 */}
                         <button
                             onClick={() => handleDeleteTask(task)}
                             className="p-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                             title="Delete Task"
                         >
                            <Trash2 size={16} />
                         </button>

                         {/* Sliding Toggle Switch */}
                         <button
                            type="button"
                            role="switch"
                            aria-checked={task.status === TaskStatus.ACTIVE}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (task.status === TaskStatus.ACTIVE) {
                                    handleStopTask(task.id);
                                } else {
                                    handleRestartTask(task.id);
                                }
                            }}
                            className={`
                                relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 z-10
                                ${task.status === TaskStatus.ACTIVE ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}
                            `}
                            title={task.status === TaskStatus.ACTIVE ? t('common.stop') : t('common.restart')}
                        >
                            <span className="sr-only">{task.status === TaskStatus.ACTIVE ? t('common.stop') : t('common.restart')}</span>
                            <span
                                aria-hidden="true"
                                className={`
                                    pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                    ${task.status === TaskStatus.ACTIVE ? 'translate-x-5' : 'translate-x-0'}
                                `}
                            />
                        </button>
                    </div>
                    </div>

                    {/* 参与者列表（展开时显示） */}
                    {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Participants</h4>
                            {participants.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No participants yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {participants.map((p: any) => (
                                        <div key={p.affiliateTaskId} className="bg-white dark:bg-slate-900 p-3 rounded-lg">
                                            {/* 🔧 修复：达人基本信息行 */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                        {p.affiliateName?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900 dark:text-white">{p.affiliateName}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.affiliateEmail}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs">
                                                    <span className={`px-2 py-1 rounded-full font-medium ${
                                                        p.affiliateTier === 'OFFICIAL_COLLABORATOR' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                                        p.affiliateTier === 'PREMIUM_INFLUENCER' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                        {p.affiliateTier}
                                                    </span>
                                                    <span className="text-slate-500 dark:text-slate-400">{p.totalClicks || 0} clicks</span>
                                                    <span className={`px-2 py-1 rounded-full font-medium ${
                                                        p.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                                        'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* 🔧 新增：推文链接显示（支持多个链接） */}
                                            {(() => {
                                                // 🔧 兼容旧数据：支持单个字符串或多行字符串
                                                const linkText = p.submittedPostLink || '';
                                                const links = linkText.trim() ? linkText.split('\n').filter(l => l.trim()) : [];

                                                if (links.length === 0) {
                                                    return (
                                                        <div className="pl-11 text-xs text-slate-400 dark:text-slate-500 italic">
                                                            No post link submitted yet
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="pl-11 text-xs space-y-1">
                                                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                                                            Post{links.length > 1 ? 's' : ''}:
                                                        </span>
                                                        {links.map((link, idx) => (
                                                            <div key={idx}>
                                                                <a
                                                                    href={link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                                                >
                                                                    {links.length > 1 ? `${idx + 1}. ` : ''}{link}
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                );
            })}
        </div>

        {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-lg relative transition-colors shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20}/></button>
                    <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">
                        {editingTaskId ? t('admin.editCampaign') : t('admin.createCampaign')}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.formTitle')}</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                value={newTask.title}
                                onChange={e => setNewTask({...newTask, title: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.formProductLink')}</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                value={newTask.productLink}
                                onChange={e => setNewTask({...newTask, productLink: e.target.value})}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.formDescription')}</label>
                            <textarea
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
                                value={newTask.description}
                                onChange={e => setNewTask({...newTask, description: e.target.value})}
                            />
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-950">
                            <div className="flex items-center gap-3 mb-3">
                                <input
                                    type="checkbox"
                                    id="specialReward"
                                    checked={newTask.isSpecialReward || false}
                                    onChange={e => setNewTask({...newTask, isSpecialReward: e.target.checked})}
                                    className="w-4 h-4 text-indigo-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="specialReward" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                    Use Special Reward Amounts
                                </label>
                            </div>

                            {!newTask.isSpecialReward && (
                                <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                    <p className="font-medium">Default Reward Standards:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>Core Partner: ${TIER_RATES[Tier.CORE_PARTNER]}/1000 clicks</li>
                                        <li>Premium Influencer: ${TIER_RATES[Tier.PREMIUM_INFLUENCER]}/1000 clicks</li>
                                        <li>Official Collaborator: ${TIER_RATES[Tier.OFFICIAL_COLLABORATOR]}/1000 clicks</li>
                                    </ul>
                                </div>
                            )}

                            {newTask.isSpecialReward && (
                                <div className="space-y-3 mt-2">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Custom Reward Amounts ($/1000 clicks):</p>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Core Partner</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                            value={newTask.specialRewards?.CORE_PARTNER || TIER_RATES[Tier.CORE_PARTNER]}
                                            onChange={e => setNewTask({
                                                ...newTask,
                                                specialRewards: {
                                                    CORE_PARTNER: parseInt(e.target.value) || 0,
                                                    PREMIUM_INFLUENCER: newTask.specialRewards?.PREMIUM_INFLUENCER || TIER_RATES[Tier.PREMIUM_INFLUENCER],
                                                    OFFICIAL_COLLABORATOR: newTask.specialRewards?.OFFICIAL_COLLABORATOR || TIER_RATES[Tier.OFFICIAL_COLLABORATOR]
                                                }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Premium Influencer</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                            value={newTask.specialRewards?.PREMIUM_INFLUENCER || TIER_RATES[Tier.PREMIUM_INFLUENCER]}
                                            onChange={e => setNewTask({
                                                ...newTask,
                                                specialRewards: {
                                                    CORE_PARTNER: newTask.specialRewards?.CORE_PARTNER || TIER_RATES[Tier.CORE_PARTNER],
                                                    PREMIUM_INFLUENCER: parseInt(e.target.value) || 0,
                                                    OFFICIAL_COLLABORATOR: newTask.specialRewards?.OFFICIAL_COLLABORATOR || TIER_RATES[Tier.OFFICIAL_COLLABORATOR]
                                                }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Official Collaborator</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                            value={newTask.specialRewards?.OFFICIAL_COLLABORATOR || TIER_RATES[Tier.OFFICIAL_COLLABORATOR]}
                                            onChange={e => setNewTask({
                                                ...newTask,
                                                specialRewards: {
                                                    CORE_PARTNER: newTask.specialRewards?.CORE_PARTNER || TIER_RATES[Tier.CORE_PARTNER],
                                                    PREMIUM_INFLUENCER: newTask.specialRewards?.PREMIUM_INFLUENCER || TIER_RATES[Tier.PREMIUM_INFLUENCER],
                                                    OFFICIAL_COLLABORATOR: parseInt(e.target.value) || 0
                                                }
                                            })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.formDeadline')}</label>
                                <input 
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={formDeadline}
                                    onChange={e => setFormDeadline(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.formRequirements')}</label>
                            <textarea 
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 h-32"
                                value={formRequirements}
                                onChange={e => setFormRequirements(e.target.value)}
                                placeholder="Enter one requirement per line..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">{t('common.cancel')}</button>
                            <button onClick={handleSaveTask} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">
                                {editingTaskId ? t('common.save') : t('admin.launchCampaign')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  const handleUpdateWithdrawalStatus = async (withdrawalId: string, newStatus: WithdrawalStatus, paymentProof?: string, adminNotes?: string) => {
    // 找到对应的提现记录，传递完整信息以便后端创建通知
    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (withdrawal) {
      await MockStore.updateWithdrawalStatus(
        withdrawalId,
        newStatus,
        paymentProof,
        adminNotes,
        withdrawal.affiliateId,
        withdrawal.amount,
        withdrawal.taskTitle
      );
    } else {
      await MockStore.updateWithdrawalStatus(withdrawalId, newStatus, paymentProof, adminNotes);
    }
    const updatedWithdrawals = await MockStore.getAllWithdrawals();
    setWithdrawals(updatedWithdrawals);
  };

  // 计算提现统计数据
  const calculateWithdrawalStats = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 总提现金额
    const totalAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // 已完成提现金额
    const completedAmount = withdrawals
      .filter(w => w.status === WithdrawalStatus.COMPLETED)
      .reduce((sum, w) => sum + w.amount, 0);

    // 待处理金额
    const pendingAmount = withdrawals
      .filter(w => w.status === WithdrawalStatus.PENDING || w.status === WithdrawalStatus.PROCESSING)
      .reduce((sum, w) => sum + w.amount, 0);

    // 本月提现金额
    const monthlyAmount = withdrawals
      .filter(w => {
        const date = new Date(w.requestedAt);
        return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
      })
      .reduce((sum, w) => sum + w.amount, 0);

    // 本年提现金额
    const yearlyAmount = withdrawals
      .filter(w => {
        const date = new Date(w.requestedAt);
        return date.getFullYear() === currentYear;
      })
      .reduce((sum, w) => sum + w.amount, 0);

    // 月度统计（最近12个月）
    const monthlyStats = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - i, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();

      const amount = withdrawals
        .filter(w => {
          const date = new Date(w.requestedAt);
          return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
        })
        .reduce((sum, w) => sum + w.amount, 0);

      monthlyStats.push({
        month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
        amount: amount,
        count: withdrawals.filter(w => {
          const date = new Date(w.requestedAt);
          return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
        }).length
      });
    }

    return {
      totalAmount,
      completedAmount,
      pendingAmount,
      monthlyAmount,
      yearlyAmount,
      monthlyStats,
      totalCount: withdrawals.length,
      completedCount: withdrawals.filter(w => w.status === WithdrawalStatus.COMPLETED).length,
      pendingCount: withdrawals.filter(w => w.status === WithdrawalStatus.PENDING || w.status === WithdrawalStatus.PROCESSING).length
    };
  };

  const renderWithdrawals = () => {
    const stats = calculateWithdrawalStats();

    return (
    <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total Withdrawals</span>
              <DollarSign size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">${stats.totalAmount.toFixed(2)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stats.totalCount} transactions</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Completed</span>
              <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${stats.completedAmount.toFixed(2)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stats.completedCount} transactions</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Pending</span>
              <Activity size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">${stats.pendingAmount.toFixed(2)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stats.pendingCount} transactions</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">This Month</span>
              <BarChart3 size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">${stats.monthlyAmount.toFixed(2)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">This year: ${stats.yearlyAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* 月度趋势图 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Withdrawal Trend (Last 12 Months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthlyStats}>
              <defs>
                <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, '金额']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#withdrawalGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white">Withdrawal Management</h2>
             <div className="flex gap-2">
               {/* 导出按钮 */}
               <button
                 onClick={() => {
                   // 生成CSV数据
                   const csvContent = [
                     ['达人姓名', '任务标题', '金额', '收款方式', '收款详情', '状态', '申请时间', '处理时间', '运营备注'],
                     ...withdrawals.map(w => [
                       w.affiliateName,
                       w.taskTitle,
                       w.amount.toFixed(2),
                       w.paymentMethod,
                       w.paymentDetails,
                       w.status,
                       new Date(w.requestedAt).toLocaleString('zh-CN'),
                       w.processedAt ? new Date(w.processedAt).toLocaleString('zh-CN') : '',
                       w.adminNotes || ''
                     ])
                   ].map(row => row.join(',')).join('\n');

                   // 创建下载链接
                   const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                   const link = document.createElement('a');
                   link.href = URL.createObjectURL(blob);
                   link.download = `withdrawals_${new Date().toISOString().split('T')[0]}.csv`;
                   link.click();
                 }}
                 className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
               >
                 <Upload size={16} /> 导出清单
               </button>

               {/* 批量打款按钮 */}
               <button
                 onClick={() => {
                   const pendingWithdrawals = withdrawals.filter(w =>
                     w.status === WithdrawalStatus.PENDING || w.status === WithdrawalStatus.PROCESSING
                   );
                   if (pendingWithdrawals.length === 0) {
                     alert('No pending withdrawals');
                     return;
                   }
                   const confirmed = window.confirm(
                     `Confirm batch processing of ${pendingWithdrawals.length} withdrawal requests?\n` +
                     `Total amount: $${pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0).toFixed(2)}\n\n` +
                     `All withdrawals will be marked as "processing" status.`
                   );
                   if (confirmed) {
                     // 批量更新状态
                     Promise.all(
                       pendingWithdrawals.map(w =>
                         handleUpdateWithdrawalStatus(w.id, WithdrawalStatus.PROCESSING)
                       )
                     ).then(() => {
                       alert('Batch processing completed!');
                     }).catch(error => {
                       console.error('Batch processing failed:', error);
                       alert('Batch processing failed, please try again');
                     });
                   }
                 }}
                 className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
               >
                 <CheckCircle size={16} /> 批量打款
               </button>

               {/* 审核规则按钮 */}
               <button
                 onClick={() => setShowAutoReviewModal(true)}
                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
               >
                 <SettingsIcon size={16} /> Review Rules
               </button>
             </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-colors">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                        <th className="px-6 py-4 font-medium">达人</th>
                        <th className="px-6 py-4 font-medium">任务</th>
                        <th className="px-6 py-4 font-medium">金额</th>
                        <th className="px-6 py-4 font-medium">收款方式</th>
                        <th className="px-6 py-4 font-medium">状态</th>
                        <th className="px-6 py-4 font-medium">申请时间</th>
                        <th className="px-6 py-4 font-medium">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {withdrawals.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                No withdrawal requests
                            </td>
                        </tr>
                    ) : (
                        withdrawals.map((w: WithdrawalRequest) => (
                            <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{w.affiliateName}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{w.taskTitle}</td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-medium">${w.amount.toFixed(2)}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{w.paymentMethod}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        w.status === WithdrawalStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                        w.status === WithdrawalStatus.PROCESSING ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                        w.status === WithdrawalStatus.REJECTED ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                        'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {w.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                    {new Date(w.requestedAt).toLocaleDateString('zh-CN')}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        {w.status === WithdrawalStatus.PENDING && (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateWithdrawalStatus(w.id, WithdrawalStatus.PROCESSING)}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                                                >
                                                    Processing
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const notes = prompt('Rejection reason:');
                                                        if (notes) handleUpdateWithdrawalStatus(w.id, WithdrawalStatus.REJECTED, undefined, notes);
                                                    }}
                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {w.status === WithdrawalStatus.PROCESSING && (
                                            <button
                                                onClick={() => {
                                                    const proof = prompt('Payment proof URL:');
                                                    if (proof) handleUpdateWithdrawalStatus(w.id, WithdrawalStatus.COMPLETED, proof);
                                                }}
                                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                                            >
                                                标记完成
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
    );
  };

  // 渲染达人审核页面
  const renderApproval = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Affiliate Approval</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and approve new affiliate registrations
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-900 dark:text-amber-300">
            {pendingAffiliates.length} Pending
          </span>
        </div>
      </div>

      {pendingAffiliates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full mb-4">
              <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              All Caught Up!
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              No pending affiliate registrations to review
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingAffiliates.map(affiliate => (
            <div
              key={affiliate.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <img
                    src={affiliate.avatar}
                    alt={affiliate.name}
                    className="w-16 h-16 rounded-full border-2 border-slate-200 dark:border-slate-700"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {affiliate.name}
                      </h3>
                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-full">
                        PENDING
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-3">
                      <Mail size={14} />
                      {affiliate.email}
                    </div>

                    {/* 社交媒体链接 */}
                    {affiliate.socialLinks && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {affiliate.socialLinks.twitter && (
                          <a
                            href={affiliate.socialLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <Twitter size={12} />
                            Twitter
                          </a>
                        )}
                        {affiliate.socialLinks.youtube && (
                          <a
                            href={affiliate.socialLinks.youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <Youtube size={12} />
                            YouTube
                          </a>
                        )}
                        {affiliate.socialLinks.instagram && (
                          <a
                            href={affiliate.socialLinks.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-lg text-xs font-medium hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors"
                          >
                            <Instagram size={12} />
                            Instagram
                          </a>
                        )}
                      </div>
                    )}

                    {/* 粉丝数 */}
                    {affiliate.followerCount && (
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Users size={14} />
                        <span>{affiliate.followerCount.toLocaleString()} followers</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 ml-4">
                  {rejectingUserId === affiliate.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Rejection reason..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setRejectingUserId(null);
                            setRejectionReason('');
                          }}
                          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRejectAffiliate(affiliate.id)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Confirm Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApproveAffiliate(affiliate.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <CheckCircle size={16} />
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingUserId(affiliate.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <UserX size={16} />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAffiliates = () => {
    // 🔧 已将 selectedTier 状态移到组件顶层，避免在渲染函数中调用 useState

    // 根据搜索、标签和等级筛选达人
    const filteredAffiliates = affiliates.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             a.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = selectedTag === 'All' || (a.tags && a.tags.includes(selectedTag));
        const matchesTier = selectedTier === 'All' || a.tier === selectedTier;
        return matchesSearch && matchesTag && matchesTier;
    });

    // 统计每个标签的达人数量
    const tagCounts = AVAILABLE_TAGS.reduce((acc, tag) => {
        acc[tag] = affiliates.filter(a => a.tags && a.tags.includes(tag)).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h2 className="text-xl font-bold whitespace-nowrap text-slate-900 dark:text-white">{t('admin.affiliateManagement')}</h2>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder={t('admin.searchAffiliate')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={handleAutoImportAll}
                            disabled={importing}
                            className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Auto-import all KOLs from CSV files"
                        >
                            {importing ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Import All
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors"
                        >
                            <Upload size={16} />
                            Import CSV
                        </button>

                        <button
                            onClick={() => setShowAddKolModal(true)}
                            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors"
                        >
                            <Plus size={16} />
                            {t('admin.manualAdd')}
                        </button>

                        <button
                            onClick={handleSyncKOLs}
                            disabled={syncing}
                            className="flex-1 md:flex-none bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors border border-slate-200 dark:border-slate-700"
                        >
                            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                            {syncing ? t('admin.syncing') : t('admin.syncKol')}
                        </button>

                        <a
                            href={GOOGLE_SHEET_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-none bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700"
                            title={t('admin.openSheet')}
                        >
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>

            {syncMessage && (
                <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${syncMessage.includes('Failed') ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                    {syncMessage.includes('Failed') ? <AlertTriangle size={16}/> : <CheckCircle size={16}/>}
                    {syncMessage}
                </div>
            )}

            {/* 等级筛选下拉框 */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter by Tier:</label>
                <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                    <option value="All">All Tiers</option>
                    <option value={Tier.CORE_PARTNER}>Core Partner</option>
                    <option value={Tier.PREMIUM_INFLUENCER}>Premium Influencer</option>
                    <option value={Tier.OFFICIAL_COLLABORATOR}>Official Collaborator</option>
                </select>
            </div>

            {/* 标签筛选按钮组 */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setSelectedTag('All')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTag === 'All'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-500'
                    }`}
                >
                    All ({affiliates.length})
                </button>
                {AVAILABLE_TAGS.map((tag) => (
                    <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedTag === tag
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-500'
                        }`}
                    >
                        {tag} ({tagCounts[tag] || 0})
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[200px] transition-colors">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 font-medium">{t('admin.colName')}</th>
                            <th className="px-6 py-4 font-medium">{t('admin.colTier')}</th>
                            <th className="px-6 py-4 font-medium">{t('admin.colFollowers')}</th>
                            <th className="px-6 py-4 font-medium">{t('admin.colEarnings')}</th>
                            <th className="px-6 py-4 font-medium text-center">操作</th>
                            <th className="px-6 py-4 font-medium w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredAffiliates.length > 0 ? (
                            filteredAffiliates.map(aff => {
                                const tierKey = `admin.tier${aff.tier ? aff.tier.charAt(0).toUpperCase() + aff.tier.slice(1).toLowerCase() : 'Bronze'}`;
                                return (
                                <React.Fragment key={aff.id}>
                                    <tr 
                                        onClick={() => toggleRow(aff.id)}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={aff.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                                                <div>
                                                    <div className="font-medium text-slate-900 dark:text-white">{aff.name}</div>
                                                    <div className="text-xs text-slate-500">{aff.email}</div>
                                                    {/* 标签徽章 */}
                                                    {aff.tags && aff.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {aff.tags.map((tag, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2 mt-1">
                                                        {aff.socialLinks?.twitter && <a href={aff.socialLinks.twitter} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-500"><Twitter size={12}/></a>}
                                                        {aff.socialLinks?.youtube && <a href={aff.socialLinks.youtube} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-red-500"><Youtube size={12}/></a>}
                                                        {aff.socialLinks?.instagram && <a href={aff.socialLinks.instagram} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-pink-500"><Instagram size={12}/></a>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                                ${aff.tier === Tier.OFFICIAL_COLLABORATOR ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                                  aff.tier === Tier.PREMIUM_INFLUENCER ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                                  'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                                {t(tierKey)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {aff.followerCount ? aff.followerCount.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono">
                                            ${aff.totalEarnings?.toLocaleString() ?? 0}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    // 确认删除
                                                    const confirmed = window.confirm(
                                                        `Are you sure you want to delete affiliate "${aff.name}" (${aff.email})?\n\n` +
                                                        `This operation will:\n` +
                                                        `1. Delete all affiliate data\n` +
                                                        `2. Delete tracking links and click records\n` +
                                                        `3. Delete withdrawal records\n\n` +
                                                        `This action cannot be undone!`
                                                    );

                                                    if (!confirmed) return;

                                                    try {
                                                        // 调用后端API删除数据库记录
                                                        const response = await fetch(`/api/user/${aff.id}`, {
                                                            method: 'DELETE',
                                                        });

                                                        if (response.ok) {
                                                            // 从 MockStore 中删除
                                                            await MockStore.deleteAffiliate(aff.id);

                                                            // 刷新列表
                                                            const updatedList = await MockStore.getAffiliates();
                                                            setAffiliates(updatedList);

                                                            // 更新概览数据
                                                            const ov = await MockStore.getAdminOverviewStats();
                                                            setOverviewData(ov);

                                                            alert(`Affiliate "${aff.name}" deleted successfully`);
                                                        } else {
                                                            throw new Error('Deletion failed');
                                                        }
                                                    } catch (error: any) {
                                                        console.error('删除达人失败:', error);
                                                        alert(`Deletion failed: ${error.message || 'Unknown error'}`);
                                                    }
                                                }}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                                                title="Delete Affiliate"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                                <ChevronRight size={16} className={`transition-transform duration-200 ${expandedRows.has(aff.id) ? 'rotate-90' : ''}`}/>
                                            </button>
                                        </td>
                                    </tr>
                                    {/* Expanded Detail Row */}
                                    {expandedRows.has(aff.id) && (
                                        <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="flex flex-col md:flex-row gap-6 p-2">
                                                    <div className="space-y-4 flex-1">
                                                        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('admin.viewProfile')}</h4>
                                                        
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Mail size={12}/> Email</p>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 select-all">{aff.email}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Wallet size={12}/> Wallet Address (TRC20)</p>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 font-mono select-all">
                                                                    {aff.walletAddress || 'Not set'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Twitter size={12}/> Twitter</p>
                                                                {aff.socialLinks?.twitter ? 
                                                                    <a href={aff.socialLinks.twitter} target="_blank" className="text-sm text-blue-500 hover:underline truncate block">{aff.socialLinks.twitter}</a> : 
                                                                    <span className="text-sm text-slate-400">-</span>
                                                                }
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Youtube size={12}/> YouTube</p>
                                                                {aff.socialLinks?.youtube ? 
                                                                    <a href={aff.socialLinks.youtube} target="_blank" className="text-sm text-red-500 hover:underline truncate block">{aff.socialLinks.youtube}</a> : 
                                                                    <span className="text-sm text-slate-400">-</span>
                                                                }
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Instagram size={12}/> Instagram</p>
                                                                {aff.socialLinks?.instagram ? 
                                                                    <a href={aff.socialLinks.instagram} target="_blank" className="text-sm text-pink-500 hover:underline truncate block">{aff.socialLinks.instagram}</a> : 
                                                                    <span className="text-sm text-slate-400">-</span>
                                                                }
                                                            </div>
                                                        </div>

                                                        {/* Tier Modification Section */}
                                                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                                                                    <Award size={16} className="text-indigo-500"/>
                                                                    <span>Edit Tier Level</span>
                                                                </div>
                                                                <select
                                                                    value={aff.tier}
                                                                    onChange={(e) => handleUpdateTier(aff, e.target.value as Tier)}
                                                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                                                >
                                                                    <option value={Tier.CORE_PARTNER}>Core Partner ($50/1000)</option>
                                                                    <option value={Tier.PREMIUM_INFLUENCER}>Premium Influencer ($80/1000)</option>
                                                                    <option value={Tier.OFFICIAL_COLLABORATOR}>Official Collaborator ($100/1000)</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* 标签编辑区域 */}
                                                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Edit Tags</h5>
                                                            {/* 当前标签 */}
                                                            <div className="mb-3">
                                                                <p className="text-xs text-slate-500 mb-2">Current Tags:</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {aff.tags && aff.tags.length > 0 ? (
                                                                        aff.tags.map((tag, idx) => (
                                                                            <span
                                                                                key={idx}
                                                                                className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium flex items-center gap-2 group hover:bg-red-500/10 transition-colors"
                                                                            >
                                                                                {tag}
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        const newTags = aff.tags?.filter(t => t !== tag) || [];
                                                                                        await fetch(`/api/user/profile/${aff.id}`, {
                                                                                            method: 'PUT',
                                                                                            headers: { 'Content-Type': 'application/json' },
                                                                                            body: JSON.stringify({ tags: newTags })
                                                                                        });
                                                                                        const updatedList = await MockStore.getAffiliates();
                                                                                        setAffiliates(updatedList);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                                                >
                                                                                    <X size={14} />
                                                                                </button>
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-sm text-slate-400">No tags</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* 添加标签 */}
                                                            <div>
                                                                <p className="text-xs text-slate-500 mb-2">Add Tags:</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {AVAILABLE_TAGS.map((tag) => {
                                                                        const hasTag = aff.tags && aff.tags.includes(tag);
                                                                        return (
                                                                            <button
                                                                                key={tag}
                                                                                onClick={async () => {
                                                                                    if (!hasTag) {
                                                                                        const newTags = [...(aff.tags || []), tag];
                                                                                        await fetch(`/api/user/profile/${aff.id}`, {
                                                                                            method: 'PUT',
                                                                                            headers: { 'Content-Type': 'application/json' },
                                                                                            body: JSON.stringify({ tags: newTags })
                                                                                        });
                                                                                        const updatedList = await MockStore.getAffiliates();
                                                                                        setAffiliates(updatedList);
                                                                                    }
                                                                                }}
                                                                                disabled={hasTag}
                                                                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                                                                    hasTag
                                                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                                                                                }`}
                                                                            >
                                                                                {hasTag ? '✓ ' : '+ '}{tag}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="w-full md:w-64 bg-white dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800 h-fit">
                                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Performance (Real-time)</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-slate-500 dark:text-slate-400">Campaigns Joined</span>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                                    {creatorStats[aff.id]?.campaignsJoined ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-slate-500 dark:text-slate-400">Total Clicks</span>
                                                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                                                    {creatorStats[aff.id]?.totalClicks?.toLocaleString() ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-slate-500 dark:text-slate-400">Links Created</span>
                                                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                                    {creatorStats[aff.id]?.linksCreated ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-slate-500 dark:text-slate-400">Total Payouts</span>
                                                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${(aff.totalEarnings || 0).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                                )
                            })
                        ) : (
                             <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                                    <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-full mb-3">
                                        <Users size={24} className="text-slate-400 dark:text-slate-600"/>
                                    </div>
                                    <p>{affiliates.length === 0 ? t('admin.noAffiliatesFound') : 'No matching affiliates found.'}</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Manual Add KOL Modal */}
            {showAddKolModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-lg relative transition-colors shadow-2xl">
                        <button onClick={() => setShowAddKolModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20}/></button>
                        <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">{t('admin.addKolTitle')}</h3>
                        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelName')}</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={newKol.name}
                                    onChange={e => setNewKol({...newKol, name: e.target.value})}
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelEmail')}</label>
                                <input 
                                    type="email" 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={newKol.email}
                                    onChange={e => setNewKol({...newKol, email: e.target.value})}
                                    placeholder="jane@example.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelTier')}</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                        value={newKol.tier}
                                        onChange={e => setNewKol({...newKol, tier: e.target.value as Tier})}
                                    >
                                        <option value={Tier.CORE_PARTNER}>Core Partner ($50/1000)</option>
                                        <option value={Tier.PREMIUM_INFLUENCER}>Premium Influencer ($80/1000)</option>
                                        <option value={Tier.OFFICIAL_COLLABORATOR}>Official Collaborator ($100/1000)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelFollowers')}</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                        value={newKol.followerCount}
                                        onChange={e => setNewKol({...newKol, followerCount: Number(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelTwitter')}</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={newKol.socialLinks?.twitter}
                                    onChange={e => setNewKol({...newKol, socialLinks: {...newKol.socialLinks, twitter: e.target.value}})}
                                    placeholder="https://twitter.com/..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelYoutube')}</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={newKol.socialLinks?.youtube}
                                    onChange={e => setNewKol({...newKol, socialLinks: {...newKol.socialLinks, youtube: e.target.value}})}
                                    placeholder="https://youtube.com/..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelInstagram')}</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={newKol.socialLinks?.instagram}
                                    onChange={e => setNewKol({...newKol, socialLinks: {...newKol.socialLinks, instagram: e.target.value}})}
                                    placeholder="https://instagram.com/..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('admin.labelTiktok')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                    value={newKol.socialLinks?.tiktok}
                                    onChange={e => setNewKol({...newKol, socialLinks: {...newKol.socialLinks, tiktok: e.target.value}})}
                                    placeholder="https://tiktok.com/@..."
                                />
                            </div>

                            {/* 标签选择 */}
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Tag Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_TAGS.map((tag) => {
                                        const isSelected = newKol.tags?.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => {
                                                    const currentTags = newKol.tags || [];
                                                    if (isSelected) {
                                                        setNewKol({...newKol, tags: currentTags.filter(t => t !== tag)});
                                                    } else {
                                                        setNewKol({...newKol, tags: [...currentTags, tag]});
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {isSelected ? '✓ ' : ''}{tag}
                                            </button>
                                        );
                                    })}
                                </div>
                                {newKol.tags && newKol.tags.length > 0 && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        已选择 {newKol.tags.length} 个标签
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setShowAddKolModal(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">{t('common.cancel')}</button>
                                <button onClick={handleAddKol} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">{t('common.add')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Import Modal */}
            {showImportModal && !showImportPreview && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-lg relative transition-colors shadow-2xl">
                        <button onClick={handleCancelImport} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X size={20}/>
                        </button>

                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Import KOL Data</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Upload a CSV file to batch import KOL information. The file should include columns: Name, Handle, Platform, Tier, Followers, Category, Email, etc.
                        </p>

                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="csv-upload"
                                disabled={importing}
                            />
                            <label
                                htmlFor="csv-upload"
                                className="cursor-pointer flex flex-col items-center gap-3"
                            >
                                <Upload size={48} className="text-slate-400" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                        点击选择 CSV 文件
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        或拖拽文件到此处
                                    </p>
                                </div>
                            </label>
                        </div>

                        {importing && (
                            <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                                <RefreshCw size={16} className="animate-spin" />
                                <span className="text-sm">Parsing file...</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={handleCancelImport}
                                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Import Preview Modal */}
            {showImportPreview && importResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-6xl relative transition-colors shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <button onClick={handleCancelImport} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X size={20}/>
                        </button>

                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Import Preview</h3>

                        {/* 统计信息 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{importResult.total}</p>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">To Import</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importResult.success}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">GOLD</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{getTierStats(importResult.users).gold}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">SILVER</p>
                                <p className="text-2xl font-bold text-slate-400">{getTierStats(importResult.users).silver}</p>
                            </div>
                        </div>

                        {/* 标签统计 */}
                        <div className="mb-4">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tag Distribution:</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(getTagStats(importResult.users)).map(([tag, count]) => (
                                    <span
                                        key={tag}
                                        className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium"
                                    >
                                        {tag}: {count}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* 预览表格 */}
                        <div className="flex-1 overflow-auto custom-scrollbar mb-6">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">First 10 entries preview:</p>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Email</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Tier</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Followers</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Tags</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generatePreviewData(importResult.users, 10).map((user, idx) => (
                                        <tr key={idx} className="border-b border-slate-200 dark:border-slate-800">
                                            <td className="px-4 py-2 text-slate-900 dark:text-white">{user.name}</td>
                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                                {user.email || <span className="text-slate-400">(None)</span>}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                    user.tier === Tier.OFFICIAL_COLLABORATOR ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                                    user.tier === Tier.PREMIUM_INFLUENCER ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                                    'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                }`}>
                                                    {user.tier}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                                                {user.followerCount?.toLocaleString() || 0}
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.tags?.slice(0, 2).map((tag, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-xs"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 错误信息 */}
                        {importResult.errors.length > 0 && (
                            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg max-h-32 overflow-y-auto">
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
                                    ⚠️ 注意事项 ({importResult.errors.length} 条):
                                </p>
                                <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                    {importResult.errors.slice(0, 5).map((error, idx) => (
                                        <li key={idx}>• {error}</li>
                                    ))}
                                    {importResult.errors.length > 5 && (
                                        <li className="font-medium">... 还有 {importResult.errors.length - 5} 条</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                            <button
                                onClick={handleCancelImport}
                                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                disabled={importing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                disabled={importing}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importing ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        Confirm Import {importResult.success} KOLs
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('common.adminCenter')}</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage tasks, monitor traffic quality, and settle payments.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 全局刷新按钮 */}
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            title="Manual Refresh (Auto-refresh every 10s)"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-colors">
              <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {refreshing ? 'Syncing...' : 'Live Sync'}
              </span>
              <span className="text-xs text-slate-400">
                (every 10s)
              </span>
          </div>
        </div>
      </div>

      {renderNav()}

      <div className="mt-6">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'TASKS' && renderTasks()}
        {activeTab === 'AFFILIATES' && renderAffiliates()}
        {activeTab === 'WITHDRAWALS' && renderWithdrawals()}
        {activeTab === 'APPROVAL' && renderApproval()}
      </div>

      {/* 异常预警详情模态框 */}
      {/* 自动审核规则弹窗 */}
      {showAutoReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAutoReviewModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Auto Review Rules Configuration</h2>
              <button onClick={() => setShowAutoReviewModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* 启用开关 */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">Enable Auto Review</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Withdrawals meeting the criteria will be automatically approved</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReviewRules.enabled}
                    onChange={(e) => setAutoReviewRules({...autoReviewRules, enabled: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* 金额范围 */}
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900 dark:text-white">Amount Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Minimum Amount ($)</label>
                    <input
                      type="number"
                      value={autoReviewRules.minAmount}
                      onChange={(e) => setAutoReviewRules({...autoReviewRules, minAmount: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Maximum Amount ($)</label>
                    <input
                      type="number"
                      value={autoReviewRules.maxAmount}
                      onChange={(e) => setAutoReviewRules({...autoReviewRules, maxAmount: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">小额自动通过 ($)</label>
                  <input
                    type="number"
                    value={autoReviewRules.autoApproveUnder}
                    onChange={(e) => setAutoReviewRules({...autoReviewRules, autoApproveUnder: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-xs text-slate-500 mt-1">Withdrawals below this amount that meet other criteria will be auto-approved</p>
                </div>
              </div>

              {/* 风控条件 */}
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900 dark:text-white">风控条件</h3>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">最少完成任务数</label>
                  <input
                    type="number"
                    value={autoReviewRules.minTasksCompleted}
                    onChange={(e) => setAutoReviewRules({...autoReviewRules, minTasksCompleted: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoReviewRules.requireVerifiedAccount}
                    onChange={(e) => setAutoReviewRules({...autoReviewRules, requireVerifiedAccount: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Require verified account</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoReviewRules.blacklistCheck}
                    onChange={(e) => setAutoReviewRules({...autoReviewRules, blacklistCheck: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">启用黑名单检查</span>
                </label>
              </div>

              {/* 保存按钮 */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowAutoReviewModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // TODO: 保存规则到后端
                    console.log('保存自动审核规则:', autoReviewRules);
                    alert('Rules saved!');
                    setShowAutoReviewModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Rules
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAnomaliesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAnomaliesModal(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">异常点击预警详情</h2>
                    <button onClick={() => setShowAnomaliesModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
                    {anomalies.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                            <p>No anomalies detected</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {anomalies.map((anomaly, idx) => (
                                <div key={idx} className={`p-4 rounded-lg border ${anomaly.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={18} className={anomaly.severity === 'high' ? 'text-red-500' : 'text-orange-500'} />
                                            <span className={`text-sm font-bold uppercase ${anomaly.severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                                {anomaly.severity === 'high' ? '高危' : '中危'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500">{new Date(anomaly.detectedAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-white font-medium mb-1">{anomaly.details}</p>
                                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                        {anomaly.ipAddress && (
                                            <div>
                                                <span className="text-slate-500">IP 地址:</span>
                                                <span className="ml-2 font-mono text-slate-900 dark:text-white">{anomaly.ipAddress}</span>
                                            </div>
                                        )}
                                        {anomaly.linkCode && (
                                            <div>
                                                <span className="text-slate-500">短链接:</span>
                                                <span className="ml-2 font-mono text-slate-900 dark:text-white">{anomaly.linkCode}</span>
                                            </div>
                                        )}
                                        {anomaly.clickCount && (
                                            <div>
                                                <span className="text-slate-500">点击次数:</span>
                                                <span className="ml-2 font-bold text-slate-900 dark:text-white">{anomaly.clickCount}</span>
                                            </div>
                                        )}
                                        {anomaly.uniqueLinks && (
                                            <div>
                                                <span className="text-slate-500">不同链接数:</span>
                                                <span className="ml-2 font-bold text-slate-900 dark:text-white">{anomaly.uniqueLinks}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};