import React from 'react';
import { X, Sparkles, Target, DollarSign, BarChart3 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
}

export const WelcomeModal: React.FC<Props> = ({ isOpen, userName, onClose }) => {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  const features = language === 'zh'
    ? [
        {
          icon: Target,
          title: '浏览任务广场',
          description: '在"任务广场"页面查看最新的推广任务，选择适合您的项目',
          color: 'text-indigo-600 dark:text-indigo-400'
        },
        {
          icon: DollarSign,
          title: '领取并推广',
          description: '领取任务后获得专属追踪链接，分享给您的粉丝即可开始赚取收益',
          color: 'text-emerald-600 dark:text-emerald-400'
        },
        {
          icon: BarChart3,
          title: '实时查看数据',
          description: '在"我的数据"页面追踪点击量、转化率和预估收益，所有数据实时更新',
          color: 'text-purple-600 dark:text-purple-400'
        }
      ]
    : [
        {
          icon: Target,
          title: 'Browse Task Market',
          description: 'Check the "Task Market" page for the latest campaigns and choose projects that fit your audience',
          color: 'text-indigo-600 dark:text-indigo-400'
        },
        {
          icon: DollarSign,
          title: 'Claim & Promote',
          description: 'Claim tasks to get your unique tracking link, then share it with your followers to start earning',
          color: 'text-emerald-600 dark:text-emerald-400'
        },
        {
          icon: BarChart3,
          title: 'Track Real-time Data',
          description: 'Monitor clicks, conversion rates, and estimated earnings in "My Performance" with real-time updates',
          color: 'text-purple-600 dark:text-purple-400'
        }
      ];

  const title = language === 'zh'
    ? `欢迎加入达人中心，${userName}！`
    : `Welcome to Affiliate Hub, ${userName}!`;

  const subtitle = language === 'zh'
    ? '让我们快速了解如何开始赚取收益'
    : "Let's quickly learn how to start earning";

  const buttonText = language === 'zh' ? '开始探索' : 'Start Exploring';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl relative transition-colors shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white z-10 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>

        {/* 头部背景装饰 */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/5 dark:to-purple-500/5"></div>

        <div className="p-8 relative">
          {/* 图标 */}
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
            <Sparkles size={32} className="text-white" />
          </div>

          {/* 标题 */}
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {subtitle}
          </p>

          {/* 功能介绍 */}
          <div className="space-y-6 mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-4 items-start group">
                <div className={`w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={20} className={feature.color} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 按钮 */}
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {buttonText} <Sparkles size={18} />
          </button>

          {/* 提示文本 */}
          <p className="text-xs text-center text-slate-400 mt-4">
            {language === 'zh'
              ? '提示：您可以随时在"个人资料"页面中编辑您的信息'
              : 'Tip: You can edit your information anytime in the "Profile" page'}
          </p>
        </div>
      </div>
    </div>
  );
};
