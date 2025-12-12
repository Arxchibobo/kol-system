import React from 'react';
import { X, Link2, MapPin, CheckCircle } from 'lucide-react';

interface TaskGuideModalProps {
  isOpen: boolean;
  taskTitle: string;
  onComplete: () => void;
}

export const TaskGuideModal: React.FC<TaskGuideModalProps> = ({
  isOpen,
  taskTitle,
  onComplete
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl relative transition-colors shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">📋 任务指引</h2>
          <p className="text-indigo-100 text-sm">任务：{taskTitle}</p>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            恭喜您成功领取任务！在开始推广前，请仔细阅读以下重要提醒：
          </p>

          {/* 提醒 1 */}
          <div className="flex gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Link2 size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                1. 需要提供推广 link
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                请使用系统为您生成的专属追踪链接进行推广。这个链接包含您的唯一标识，可以准确统计点击数据和转化效果。切勿使用其他链接，否则无法正确计算您的收益。
              </p>
            </div>
          </div>

          {/* 提醒 2 */}
          <div className="flex gap-4 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <MapPin size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                2. 说明发布平台和 post 链接
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                在"Proof of Work"（工作证明）中提交您发布内容的链接，并清楚标明发布平台（如 Twitter、Instagram、YouTube、TikTok 等）。这有助于我们验证您的推广活动并评估效果。
              </p>
            </div>
          </div>

          {/* 提醒 3 */}
          <div className="flex gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                3. 根据 post 互动率判断有效性
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                系统会对照您的 post 互动率（点赞、评论、分享等）来判断点击是否为有效流量。请确保您的推广内容真实、优质，避免使用虚假流量或机器人点击，这些将不会计入有效点击。
              </p>
            </div>
          </div>

          {/* 友情提示 */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-bold">💡 友情提示：</span>
              高质量的推广内容和真实的粉丝互动是获得更多收益的关键。我们鼓励创意内容和真诚推荐！
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={onComplete}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            我已了解，开始任务
            <CheckCircle size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
