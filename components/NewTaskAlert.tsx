import React from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';

interface NewTaskAlertProps {
  isOpen: boolean;
  taskCount: number;
  onViewTasks: () => void;
  onDismiss: () => void;
}

export const NewTaskAlert: React.FC<NewTaskAlertProps> = ({
  isOpen,
  taskCount,
  onViewTasks,
  onDismiss
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onDismiss}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md relative transition-colors shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* 动画背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/5 dark:via-purple-500/5 dark:to-pink-500/5"></div>

        {/* 内容 */}
        <div className="relative p-8 text-center">
          {/* 图标 */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full mb-4 animate-pulse">
            <Sparkles size={32} className="text-white" />
          </div>

          {/* 标题 */}
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            🎉 New Tasks Available!
          </h2>

          {/* 描述 */}
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xl">{taskCount}</span> new {taskCount === 1 ? 'task has' : 'tasks have'} been published
          </p>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Check out the new opportunities! Claim tasks now and start earning.
          </p>

          {/* 按钮组 */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onViewTasks}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              View New Tasks
              <ChevronRight size={20} />
            </button>

            <button
              onClick={onDismiss}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3 rounded-xl transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
