import React, { useState, useEffect, useCallback } from 'react';
import { User, Task, AffiliateTask, Tier, TIER_RATES, TIER_THRESHOLDS } from '../types';
import { MockStore } from '../services/mockStore';
import { LayoutGrid, Target, Award, DollarSign, ExternalLink, Copy, CheckCircle, BarChart3, Settings as SettingsIcon, Play, Loader2, X, ChevronRight, AlertCircle, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  user: User;
}

type Tab = 'DASHBOARD' | 'MARKET' | 'MY_TASKS' | 'PROFILE';

export const AffiliateDashboard: React.FC<Props> = ({ user: initialUser }) => {
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

  const { t } = useLanguage();
  const { theme } = useTheme();

  const loadData = useCallback(async () => {
    // 1. Fetch Latest User Data (for accurate stats like Total Clicks)
    const refreshedUser = await MockStore.login(initialUser.email);
    if (refreshedUser) {
        setDashboardUser(refreshedUser);
    }

    // 2. Fetch Tasks and Stats
    const t = await MockStore.getTasks(initialUser.role);
    const mt = await MockStore.getMyTasks(initialUser.id);
    const s = await MockStore.getStats(initialUser.id, initialUser.role);
    
    // Filter out tasks already claimed
    const claimedIds = new Set(mt.map(i => i.taskId));
    setAllTasks(t);
    setAvailableTasks(t.filter(task => !claimedIds.has(task.id) && task.status === 'ACTIVE'));
    setMyTasks(mt);
    setStats(s);
  }, [initialUser]);

  useEffect(() => {
    loadData();
  }, [loadData, activeTab]);

  const handleClaim = async (task: Task) => {
    const newTask = await MockStore.claimTask(dashboardUser.id, task);
    setMyTasks([...myTasks, newTask]);
    setAvailableTasks(availableTasks.filter(t => t.id !== task.id));
    setSelectedTask(null); // Close modal
    setActiveTab('MY_TASKS');
  };
  
  const handleGiveUp = async (affTaskId: string) => {
      if (window.confirm(t('affiliate.confirmGiveUp'))) {
          await MockStore.giveUpTask(affTaskId);
          await loadData(); // Reload data to refresh Available Tasks list
      }
  };

  const handleSubmitLink = async (affTaskId: string, link: string) => {
    await MockStore.submitPost(affTaskId, link);
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
    await loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  // 个人资料编辑状态
  const [profileData, setProfileData] = useState({
    followerCount: 0,
    walletAddress: '',
    twitter: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // 加载用户资料时初始化
  useEffect(() => {
    setProfileData({
      followerCount: dashboardUser.followerCount || 0,
      walletAddress: dashboardUser.walletAddress || '',
      twitter: dashboardUser.socialLinks?.twitter || ''
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
          name: dashboardUser.name,
          email: dashboardUser.email,
          avatar: dashboardUser.avatar
        })
      });

      // 重新加载数据
      await loadData();
      alert('个人资料已保存');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败,请重试');
    } finally {
      setSavingProfile(false);
    }
  };


  const renderNav = () => (
    <div className="flex space-x-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit mb-8 transition-colors">
        {[
            { id: 'DASHBOARD', icon: LayoutGrid, label: t('affiliate.dashboard') },
            { id: 'MARKET', icon: Target, label: t('affiliate.market') },
            { id: 'MY_TASKS', icon: BarChart3, label: t('affiliate.myTasks') },
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
                        {t('affiliate.earnRate', { rate: TIER_RATES[dashboardUser.tier || Tier.BRONZE] })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-sm">{t('affiliate.nextSettlement')}</p>
                    <p className="text-2xl font-bold text-white mb-2">${dashboardUser.pendingEarnings?.toFixed(2) || '0.00'}</p>
                    <button className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">
                        {t('affiliate.requestWithdrawal')}
                    </button>
                </div>
            </div>
        </div>

        {/* Stats Grid - Performance (Real-time) */}
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Performance (Real-time)</h3>
            <button
                onClick={handleRefreshStats}
                disabled={refreshing}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                title="刷新数据"
            >
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
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

  const renderMarket = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableTasks.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-500 dark:text-slate-400">
                {t('affiliate.noTasks')}
            </div>
        )}
        {availableTasks.map(task => (
            <div key={task.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition-colors group shadow-sm dark:shadow-none">
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded uppercase">{t('affiliate.new')}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{new Date(task.deadline).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">{task.description}</p>
                    
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                            <DollarSign size={14} className="mr-2 text-emerald-600 dark:text-emerald-400"/> {t('affiliate.baseReward', { rate: task.rewardRate })}
                        </div>
                        <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                            <Target size={14} className="mr-2 text-indigo-600 dark:text-indigo-400"/> {t('affiliate.requirements', { count: task.requirements.length })}
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

  const renderMyTasks = () => (
    <div className="space-y-6">
        {myTasks.length === 0 && (
             <div className="text-center py-20 text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                No tasks claimed yet. Go to the Market to find campaigns!
            </div>
        )}
        {myTasks.map(at => {
            const taskDef = allTasks.find(t => t.id === at.taskId) || { title: 'Unknown Task', description: '' }; 
            
            return (
                <div key={at.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors relative group">
                    {/* Give Up Button (Only for CLAIMED status) */}
                    {at.status === 'CLAIMED' && (
                        <button 
                            onClick={() => handleGiveUp(at.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                            title={t('affiliate.giveUp')}
                        >
                            <Trash2 size={16} />
                        </button>
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

                            {/* Post Submission */}
                            <div className="mb-4">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">{t('affiliate.proofOfWork')}</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder={t('affiliate.pasteLink')}
                                        defaultValue={at.submittedPostLink}
                                        onBlur={(e) => handleSubmitLink(at.id, e.target.value)}
                                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 w-full text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none transition-colors"
                                        disabled={at.status === 'VERIFIED'}
                                    />
                                    {at.status !== 'VERIFIED' && <button className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 whitespace-nowrap px-2">{t('common.save')}</button>}
                                </div>
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
                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${at.stats.estimatedEarnings.toFixed(2)}</p>
                             </div>
                             <div>
                                <p className="text-xs text-slate-500">{t('affiliate.conversion')}</p>
                                <p className="text-sm font-mono text-slate-600 dark:text-slate-300">{(at.stats.conversionRate * 100).toFixed(1)}%</p>
                             </div>
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
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full transition-colors">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('affiliate.systemOperational')}</span>
        </div>
      </div>

      {renderNav()}

      {activeTab === 'DASHBOARD' && renderDashboard()}
      {activeTab === 'MARKET' && renderMarket()}
      {activeTab === 'MY_TASKS' && renderMyTasks()}
      {activeTab === 'PROFILE' && (
          <div className="max-w-2xl">
              <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">{t('affiliate.profileSettings')}</h2>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-6 transition-colors">
                  <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('affiliate.displayName')}</label>
                      <input type="text" value={dashboardUser.name} readOnly className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-500 cursor-not-allowed" />
                  </div>

                  {/* 粉丝量输入框 - 可编辑 */}
                  <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                          粉丝量
                          <span className="ml-2 text-xs text-slate-400">(可手动编辑)</span>
                      </label>
                      <input
                          type="number"
                          value={profileData.followerCount}
                          onChange={(e) => setProfileData({...profileData, followerCount: parseInt(e.target.value) || 0})}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          placeholder="请输入粉丝数量"
                      />
                  </div>

                  <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('affiliate.walletAddress')}</label>
                      <input
                          type="text"
                          value={profileData.walletAddress}
                          onChange={(e) => setProfileData({...profileData, walletAddress: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                  </div>
                  <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t('affiliate.twitterUrl')}</label>
                      <input
                          type="text"
                          value={profileData.twitter}
                          onChange={(e) => setProfileData({...profileData, twitter: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                  </div>
                  <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                      {savingProfile ? (
                          <>
                              <RefreshCw size={16} className="animate-spin" />
                              保存中...
                          </>
                      ) : (
                          t('affiliate.saveChanges')
                      )}
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
                                <DollarSign size={16} className="mr-1"/> {t('affiliate.baseReward', { rate: selectedTask.rewardRate })}
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
                            {selectedTask.requirements.map((req, idx) => (
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
                        onClick={() => handleClaim(selectedTask)}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {t('affiliate.confirmClaim')} <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};