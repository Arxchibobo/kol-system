import React, { useState, useEffect } from 'react';
import { User, Task, TaskStatus, Settlement, Tier, UserRole } from '../types';
import { MockStore } from '../services/mockStore';
import { LayoutGrid, Plus, Users, DollarSign, Activity, Search, AlertTriangle, CheckCircle, BarChart3, FileText, RefreshCw, ChevronRight, Twitter, Youtube, ExternalLink, X, Wallet, Mail, Instagram, Award } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  user: User;
}

type Tab = 'OVERVIEW' | 'TASKS' | 'AFFILIATES' | 'SETTLEMENTS';

export const AdminDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  // Overview Stats
  const [overviewData, setOverviewData] = useState({ totalClicks: 0, pendingPayout: 0, flaggedCount: 0 });

  // New Task / Edit Task Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({ title: '', description: '', productLink: '' });
  
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

  // Manual Add KOL State
  const [showAddKolModal, setShowAddKolModal] = useState(false);
  const [newKol, setNewKol] = useState<Partial<User>>({
    name: '',
    email: '',
    tier: Tier.BRONZE,
    followerCount: 0,
    socialLinks: { twitter: '', youtube: '', instagram: '', tiktok: '' }
  });

  const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1FrjSNSrNZTMgWl1dDBZIOTWQOgEO7An9UKNxUmRepG0/edit?gid=1698530545#gid=1698530545";

  // 获取真实的全局统计数据
  const fetchRealTotalStats = async () => {
    try {
      const response = await fetch('/api/admin/total-stats');
      if (response.ok) {
        const data = await response.json();
        setOverviewData(prev => ({ ...prev, totalClicks: data.totalClicks }));
      }
    } catch (error) {
      console.error('Failed to fetch total stats:', error);
    }
  };

  // 获取异常预警数据
  const fetchAnomalies = async () => {
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
  };

  // 全局刷新所有数据
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const taskList = await MockStore.getTasks(user.role);
      const s = await MockStore.getStats(user.id, user.role);
      const sett = await MockStore.getSettlements();
      const aff = await MockStore.getAffiliates();
      const ov = await MockStore.getAdminOverviewStats();

      setTasks(taskList);
      setStats(s);
      setSettlements(sett);
      setAffiliates(aff);
      setOverviewData(ov);

      // 获取真实数据
      await fetchRealTotalStats();
      await fetchAnomalies();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const taskList = await MockStore.getTasks(user.role);
      const s = await MockStore.getStats(user.id, user.role);
      const sett = await MockStore.getSettlements();
      const aff = await MockStore.getAffiliates();
      const ov = await MockStore.getAdminOverviewStats();

      setTasks(taskList);
      setStats(s);
      setSettlements(sett);
      setAffiliates(aff);
      setOverviewData(ov);

      // 获取真实数据
      fetchRealTotalStats();
      fetchAnomalies();
    };
    fetchData();
  }, [user]);

  const openCreateModal = () => {
      setEditingTaskId(null);
      setNewTask({ title: '', description: '', productLink: '' });
      
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
    setNewTask({ title: '', description: '', productLink: '' });
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
        walletAddress: ''
    };

    await MockStore.addAffiliate(userToAdd);
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
        tier: Tier.BRONZE,
        followerCount: 0,
        socialLinks: { twitter: '', youtube: '', instagram: '', tiktok: '' }
    });
  };

  const renderNav = () => (
    <div className="flex space-x-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit mb-8 transition-colors">
        {[
            { id: 'OVERVIEW', icon: LayoutGrid, label: t('admin.overview') },
            { id: 'TASKS', icon: FileText, label: t('admin.tasks') },
            { id: 'AFFILIATES', icon: Users, label: t('admin.affiliates') },
            { id: 'SETTLEMENTS', icon: DollarSign, label: t('admin.settlements') },
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
            {tasks.map(task => (
                <div key={task.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{task.title}</h3>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${task.status === TaskStatus.ACTIVE ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                {task.status}
                            </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl">{task.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                            <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <button 
                             onClick={() => handleEditClick(task)}
                             className="p-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                         >
                            {t('common.edit')}
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
            ))}
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

  const renderSettlements = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('admin.financialSettlements')}</h2>
             <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                <CheckCircle size={16} /> {t('admin.processPayment')}
             </button>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-colors">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                        <th className="px-6 py-4 font-medium">{t('admin.tableAffiliate')}</th>
                        <th className="px-6 py-4 font-medium">{t('admin.tablePeriod')}</th>
                        <th className="px-6 py-4 font-medium">{t('admin.tableAmount')}</th>
                        <th className="px-6 py-4 font-medium">{t('admin.tableStatus')}</th>
                        <th className="px-6 py-4 font-medium">{t('admin.tableTransaction')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {settlements.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{s.affiliateName}</td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{s.period}</td>
                            <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-medium">${s.amount.toLocaleString()}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                    {s.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{s.transactionHash}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderAffiliates = () => {
    const filteredAffiliates = affiliates.filter(a => 
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[200px] transition-colors">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 font-medium">{t('admin.colName')}</th>
                            <th className="px-6 py-4 font-medium">{t('admin.colTier')}</th>
                            <th className="px-6 py-4 font-medium">{t('admin.colFollowers')}</th>
                            <th className="px-6 py-4 font-medium">{t('admin.colEarnings')}</th>
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
                                                ${aff.tier === Tier.GOLD ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 
                                                  aff.tier === Tier.SILVER ? 'bg-slate-200 dark:bg-slate-200/10 text-slate-600 dark:text-slate-300' : 
                                                  'bg-amber-700/10 text-amber-600 dark:text-amber-600'}`}>
                                                {t(tierKey)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {aff.followerCount ? aff.followerCount.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono">
                                            ${aff.totalEarnings?.toLocaleString() ?? 0}
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
                                            <td colSpan={5} className="px-6 py-4">
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
                                                                    <option value={Tier.BRONZE}>{t('admin.tierBronze')}</option>
                                                                    <option value={Tier.SILVER}>{t('admin.tierSilver')}</option>
                                                                    <option value={Tier.GOLD}>{t('admin.tierGold')}</option>
                                                                </select>
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
                                        <option value={Tier.BRONZE}>{t('admin.tierBronze')}</option>
                                        <option value={Tier.SILVER}>{t('admin.tierSilver')}</option>
                                        <option value={Tier.GOLD}>{t('admin.tierGold')}</option>
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
                            
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setShowAddKolModal(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">{t('common.cancel')}</button>
                                <button onClick={handleAddKol} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">{t('common.add')}</button>
                            </div>
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
            title="刷新所有数据"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">System Operational</span>
          </div>
        </div>
      </div>

      {renderNav()}

      <div className="mt-6">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'TASKS' && renderTasks()}
        {activeTab === 'AFFILIATES' && renderAffiliates()}
        {activeTab === 'SETTLEMENTS' && renderSettlements()}
      </div>

      {/* 异常预警详情模态框 */}
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
                            <p>暂无异常预警</p>
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