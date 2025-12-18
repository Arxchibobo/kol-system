import React, { useState, useEffect } from 'react';
import { User, UserRole, Task } from '../types';
import { MockStore } from '../services/mockStore';
import { ArrowRight, Globe, Shield, Star, DollarSign, TrendingUp, Twitter, Youtube, Instagram, UserPlus, X, Music, Moon, Sun } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showcaseTasks, setShowcaseTasks] = useState<Task[]>([]);
  
  // Login Form State
  const [email, setEmail] = useState('');
  
  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTwitter, setRegTwitter] = useState('');
  const [regYoutube, setRegYoutube] = useState('');
  const [regInstagram, setRegInstagram] = useState('');
  const [regTiktok, setRegTiktok] = useState('');
  const [socialMediaError, setSocialMediaError] = useState('');

  // Modal State
  const [showRegPrompt, setShowRegPrompt] = useState(false);
  const [showImportantNotice, setShowImportantNotice] = useState(false); // 重要提示弹窗

  // Admin Login State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Load random showcase tasks
  useEffect(() => {
    const loadTasks = async () => {
        const tasks = await MockStore.getTasks(UserRole.AFFILIATE);
        // Shuffle and pick 2
        const shuffled = [...tasks].sort(() => 0.5 - Math.random());
        setShowcaseTasks(shuffled.slice(0, 2));
    };
    loadTasks();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const user = await MockStore.login(email);
    if (user) {
      onLogin(user);
    } else {
      setShowRegPrompt(true);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail) return;

    // 验证至少有一个社媒链接被填写
    const hasSocialMedia = regTwitter || regYoutube || regInstagram || regTiktok;
    if (!hasSocialMedia) {
      setSocialMediaError('Please provide at least one social media profile');
      return;
    }

    setSocialMediaError('');
    setLoading(true);
    // Simulate auto-grabbing data
    try {
        const user = await MockStore.register({
            name: regName,
            email: regEmail,
            socialLinks: {
                twitter: regTwitter,
                youtube: regYoutube,
                instagram: regInstagram,
                tiktok: regTiktok
            }
        });
        onLogin(user);
    } catch (e) {
        console.error(e);
    }
    setLoading(false);
  };

  const onAdminClick = () => {
      setShowAdminModal(true);
      setAdminEmail('');
      setAdminPassword('');
      setAdminError('');
  };

  const verifyAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      // Hardcoded check as requested by prompt
      if (adminEmail === 'admin@myshell.ai' && adminPassword === 'Myshell2026') {
          const user = await MockStore.login(adminEmail);
          if (user) onLogin(user);
      } else {
          setAdminError(t('login.invalidCredentials'));
      }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const switchToRegister = () => {
    setShowRegPrompt(false);
    setShowImportantNotice(true); // 显示重要提示
  };

  const confirmAndProceedToRegister = () => {
    setShowImportantNotice(false);
    setIsRegistering(true);
    setRegEmail(email);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex relative overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-200">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/40 dark:bg-indigo-900/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/40 dark:bg-purple-900/20 rounded-full blur-[120px]"></div>
        </div>

        {/* Global Switchers */}
        <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
             <button 
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-white/50 dark:bg-slate-900/50 rounded-full border border-slate-200 dark:border-slate-800 backdrop-blur-sm"
            >
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button 
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2 bg-white/50 dark:bg-slate-900/50 rounded-full border border-slate-200 dark:border-slate-800 backdrop-blur-sm"
            >
                <Globe size={16} />
                <span className="text-sm font-medium">{language === 'en' ? '中文' : 'English'}</span>
            </button>
        </div>

        {/* Left Side: Campaign Showcase (Hidden on Mobile) */}
        <div className="hidden lg:flex w-7/12 flex-col justify-center p-16 relative z-10 border-r border-slate-200 dark:border-slate-800/50">
             <div className="mb-12">
                 <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                    <span className="font-bold text-2xl text-white">M</span>
                </div>
                <h1 className="text-5xl font-bold mb-4 leading-tight text-slate-900 dark:text-white">
                    {t('login.title')}
                </h1>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-xl">
                    {t('login.showcaseSubtitle')}
                </p>
             </div>

             <div className="space-y-4 max-w-xl">
                 <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                     <TrendingUp size={16} /> {t('login.featuredCampaigns')}
                 </h2>
                 
                 {showcaseTasks.map(task => (
                     <div key={task.id} className="bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-6 rounded-2xl transform hover:-translate-y-1 transition-all duration-300 shadow-lg dark:shadow-xl">
                         <div className="flex justify-between items-start">
                             <div>
                                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{task.title}</h3>
                                 <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{task.description}</p>
                                 <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                                     <DollarSign size={14} />
                                     {t('login.reward')}: ${task.rewardRate}/1k clicks
                                 </div>
                             </div>
                             <div className="bg-indigo-600 px-3 py-1 rounded-full text-xs font-bold text-white">
                                 {t('login.joinCampaign')}
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full lg:w-5/12 flex flex-col items-center justify-center p-8 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm lg:bg-transparent">
            <div className="w-full max-w-md">
                
                {/* Mobile Logo */}
                <div className="lg:hidden mb-8 text-center">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
                        <span className="font-bold text-2xl text-white">M</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl dark:shadow-2xl relative transition-colors duration-200">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {isRegistering ? t('login.register') : t('login.enter')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">{t('login.subtitle')}</p>

                    {isRegistering ? (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('login.formName')}</label>
                                <input 
                                    type="text"
                                    value={regName}
                                    onChange={e => setRegName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="Crypto Ninja"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('login.formEmail')}</label>
                                <input 
                                    type="email"
                                    value={regEmail}
                                    onChange={e => setRegEmail(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="ninja@myshell.ai"
                                    required
                                />
                            </div>
                            
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-indigo-500 dark:text-indigo-400 mb-2 uppercase tracking-wide">{t('login.formSocials')}</label>
                                {socialMediaError && (
                                    <div className="mb-3 text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">
                                        {socialMediaError}
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Twitter className="absolute left-3 top-3 text-slate-400 dark:text-slate-600" size={16} />
                                        <input
                                            type="text"
                                            value={regTwitter}
                                            onChange={e => {
                                              setRegTwitter(e.target.value);
                                              if (socialMediaError) setSocialMediaError('');
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                            placeholder="Twitter Link"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Youtube className="absolute left-3 top-3 text-slate-400 dark:text-slate-600" size={16} />
                                        <input
                                            type="text"
                                            value={regYoutube}
                                            onChange={e => {
                                              setRegYoutube(e.target.value);
                                              if (socialMediaError) setSocialMediaError('');
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                            placeholder="YouTube Link"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Instagram className="absolute left-3 top-3 text-slate-400 dark:text-slate-600" size={16} />
                                        <input
                                            type="text"
                                            value={regInstagram}
                                            onChange={e => {
                                              setRegInstagram(e.target.value);
                                              if (socialMediaError) setSocialMediaError('');
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                            placeholder="Instagram Link"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Music className="absolute left-3 top-3 text-slate-400 dark:text-slate-600" size={16} />
                                        <input
                                            type="text"
                                            value={regTiktok}
                                            onChange={e => {
                                              setRegTiktok(e.target.value);
                                              if (socialMediaError) setSocialMediaError('');
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                            placeholder="TikTok Link"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all mt-4 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {loading ? t('login.analyzing') : t('login.register')} {loading && <span className="animate-spin">⟳</span>}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('login.formEmail')}</label>
                                <input 
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    required
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? t('login.authenticating') : (
                                    <>
                                        {t('login.enter')} <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-500">
                            {isRegistering ? t('login.hasAccount') : t('login.noAccount')}{' '}
                            <button
                                onClick={() => {
                                    if (isRegistering) {
                                        // 从注册切换到登录，直接切换
                                        setIsRegistering(false);
                                    } else {
                                        // 从登录切换到注册，先显示重要提示弹窗
                                        setShowImportantNotice(true);
                                    }
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
                            >
                                {isRegistering ? t('login.enter') : t('login.register')}
                            </button>
                        </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 dark:text-slate-600 text-center">
                            {t('login.agreement')}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Account Not Found Modal */}
        {showRegPrompt && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
                    <button 
                        onClick={() => setShowRegPrompt(false)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                        <X size={20} />
                    </button>
                    
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                        <UserPlus className="text-indigo-600 dark:text-indigo-400" size={24} />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('login.accountNotFound')}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed text-sm">
                        {t('login.registerPrompt')}
                    </p>
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={switchToRegister}
                            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            {t('login.registerNow')} <ArrowRight size={16} />
                        </button>
                        <button 
                            onClick={() => setShowRegPrompt(false)} 
                            className="w-full px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Admin Login Modal */}
        {showAdminModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
                    <button 
                        onClick={() => setShowAdminModal(false)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                        <X size={20} />
                    </button>
                    
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Shield size={24} className="text-indigo-600" />
                        {t('login.adminEntry')}
                    </h3>

                    <form onSubmit={verifyAdminLogin} className="space-y-4">
                        <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('login.formEmail')}</label>
                             <input 
                                type="email"
                                value={adminEmail}
                                onChange={e => setAdminEmail(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                autoFocus
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('login.password')}</label>
                             <input 
                                type="password"
                                value={adminPassword}
                                onChange={e => setAdminPassword(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                             />
                        </div>
                        
                        {adminError && (
                            <div className="text-red-500 text-sm font-medium bg-red-50 dark:bg-red-900/10 p-2 rounded-lg text-center">
                                {adminError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold py-3 rounded-xl transition-all mt-2"
                        >
                            {t('login.enter')}
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Important Notice Modal - 重要提示弹窗 */}
        {showImportantNotice && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                            <Shield className="text-amber-600 dark:text-amber-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                Important Notice
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                重要提示
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-6">
                        <div className="space-y-4 text-slate-700 dark:text-slate-300">
                            <p className="leading-relaxed">
                                To ensure fair rewards and proper tracking, <strong className="text-amber-700 dark:text-amber-400">only creators approved by MyShell and officially listed as affiliates</strong> are eligible for task rewards and payouts.
                            </p>
                            <p className="leading-relaxed">
                                Please submit your social media links to <a href="mailto:artshare@myshell.ai" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">artshare@myshell.ai</a> for review <strong className="text-amber-700 dark:text-amber-400">before registration</strong>.
                            </p>
                            <p className="leading-relaxed font-semibold text-amber-900 dark:text-amber-300">
                                ⚠️ Unapproved creators or registrations not recorded in our affiliate list will not be paid under any circumstances.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-6 text-sm text-slate-600 dark:text-slate-400">
                        <p className="mb-2">
                            <strong>提示：</strong>为确保公平奖励和正确追踪，只有经过 MyShell 批准并正式列入达人名单的创作者才有资格获得任务奖励和付款。
                        </p>
                        <p>
                            请在注册前将您的社交媒体链接提交至 <a href="mailto:artshare@myshell.ai" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">artshare@myshell.ai</a> 进行审核。未经批准的创作者或未记录在我们达人列表中的注册将在任何情况下都不会获得付款。
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowImportantNotice(false)}
                            className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                        >
                            Cancel / 取消
                        </button>
                        <button
                            onClick={confirmAndProceedToRegister}
                            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
                        >
                            I Understand, Continue / 我已了解，继续
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Hidden Admin Entry */}
        <div className="fixed bottom-4 right-4 z-50 opacity-30 hover:opacity-100 transition-opacity">
            <button
                onClick={onAdminClick}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 bg-white/50 dark:bg-slate-900/50 px-2 py-1 rounded"
            >
                <Shield size={10} /> {t('login.adminEntry')}
            </button>
        </div>
    </div>
  );
};