import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from './types';
import { MockStore } from './services/mockStore';
import { LogOut, Moon, Sun, Loader2, ExternalLink, ShieldCheck } from 'lucide-react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Sub-components
import { AdminDashboard } from './components/AdminDashboard';
import { AffiliateDashboard } from './components/AffiliateDashboard';
import { LoginPage } from './components/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Initialize redirect state immediately based on URL to prevent flash
  // This detects /r/ paths BEFORE the component even mounts fully
  const [redirecting, setRedirecting] = useState(() => {
      return window.location.pathname.startsWith('/r/');
  });
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const redirectAttempted = useRef(false);

  // --- Client-Side Redirect Interceptor ---
  useEffect(() => {
    const path = window.location.pathname;

    if (path.startsWith('/r/') && !redirectAttempted.current) {
        redirectAttempted.current = true;
        setRedirecting(true);
        console.log("Detecting redirect path:", path);

        // Decode and Redirect
        MockStore.handleClientRedirect(path).then(destination => {
            if (destination) {
                console.log("Destination found:", destination);
                setRedirectUrl(destination);

                // "Double Jump": Brief pause to let the user see the branding, then go.
                // Using window.location.replace to avoid back-button loops
                setTimeout(() => {
                    try {
                        console.log("Executing jump to:", destination);
                        window.location.replace(destination);
                    } catch (e) {
                        console.error("Auto-redirect failed:", e);
                        setErrorMsg("Auto-redirect blocked. Please click the button below.");
                    }
                }, 800);
            } else {
                setRedirecting(false); // Stop redirect mode if decode fails
                console.warn("Invalid fallback redirect link, could not decode.");
                setErrorMsg("Invalid link format.");
            }
        }).catch(err => {
            console.error("Redirect handler error:", err);
            setRedirecting(false);
            setErrorMsg("Failed to process redirect link.");
        });
    } else if (!path.startsWith('/r/')) {
        // Only run normal auth check if NOT redirecting
        const storedUser = localStorage.getItem('myshell_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);

        // 🔄 启动时自动同步 KOL 数据库内容
        // 这将从 utils/autoImportKOLs.ts 自动导入所有达人信息
        console.log('🔄 正在自动同步 KOL 数据库...');
        MockStore.autoImportAllKOLs()
            .then((result) => {
                console.log(`✅ KOL 数据同步完成: 成功 ${result.success}, 跳过 ${result.skipped}`);
            })
            .catch((error) => {
                console.error('❌ KOL 数据同步失败:', error);
            });
    }
  }, []);

  if (redirecting) {
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-900 dark:text-white transition-colors p-4">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl flex flex-col items-center gap-6 border border-slate-200 dark:border-slate-800 max-w-md w-full text-center">
                  <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-2 animate-pulse">
                    <span className="font-bold text-4xl text-white">M</span>
                  </div>
                  
                  <div className="space-y-2">
                      <h2 className="text-xl font-bold flex items-center justify-center gap-2">
                        {errorMsg ? "Action Required" : "Redirecting..."}
                      </h2>
                      <div className="flex items-center justify-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                         <ShieldCheck size={14} /> Secure Link
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                          {redirectUrl ? "Taking you to the official campaign page." : "Verifying tracking parameters..."}
                      </p>
                  </div>

                  {!errorMsg && (
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-600 h-full w-2/3 animate-[shimmer_1s_infinite]"></div>
                      </div>
                  )}

                  {/* Manual Fallback Button - Critical for reliability */}
                  {redirectUrl && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <p className="text-xs text-slate-400 mb-3">
                              {errorMsg || "If you are not redirected automatically:"}
                          </p>
                          <a 
                              href={redirectUrl}
                              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20"
                              onClick={() => console.log("Manual click to:", redirectUrl)}
                          >
                              Click Here to Continue <ExternalLink size={16} />
                          </a>
                          
                          <div className="mt-4 text-[10px] text-slate-300 dark:text-slate-600 font-mono break-all px-4 opacity-50">
                            Target Verified: {redirectUrl.substring(0, 30)}...
                          </div>
                      </div>
                  )}

                  {errorMsg && !redirectUrl && (
                      <div className="mt-4 text-red-500 text-sm">
                          {errorMsg}
                          <br />
                          <a href="/" className="text-indigo-500 hover:underline mt-2 inline-block">Return Home</a>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('myshell_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('myshell_user');
  };


  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-indigo-500">{t('common.loading')}</div>;

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed h-full z-10 transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="font-bold text-white">M</span>
          </div>
          <div>
             <h1 className="font-bold tracking-tight text-lg text-slate-900 dark:text-white">MyShell</h1>
             <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role === UserRole.ADMIN ? t('common.adminCenter') : t('common.affiliateHub')}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
            <div className="px-2 py-4">
                <div className="flex items-center gap-3 mb-6 px-2">
                    <img src={user.avatar} className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" alt="Avatar" />
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                </div>
            </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
           <button 
            onClick={toggleTheme}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors w-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === 'dark' ? t('common.darkMode') : t('common.lightMode')}</span>
          </button>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-colors w-full px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          >
            <LogOut size={18} />
            <span>{t('common.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 transition-colors duration-200">
        {user.role === UserRole.ADMIN ? (
          <AdminDashboard user={user} />
        ) : (
          <AffiliateDashboard user={user} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}