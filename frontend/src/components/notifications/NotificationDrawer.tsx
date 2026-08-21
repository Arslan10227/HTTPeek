import React, { useState } from 'react';
import { X, Bell, CheckCheck, Trash2, ExternalLink, Sparkles, ShieldCheck, Activity, Info, Tag } from 'lucide-react';
import { useNotificationStore, AppNotification } from '../../store/useNotificationStore';

export const NotificationDrawer: React.FC = () => {
  const { notifications, isDrawerOpen, closeDrawer, markAsRead, markAllAsRead, clearNotifications, unreadCount } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread' | 'update' | 'security'>('all');

  if (!isDrawerOpen) return null;

  const filteredList = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'update') return n.type === 'update';
    if (filter === 'security') return n.type === 'security';
    return true;
  });

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'update': return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'security': return <ShieldCheck className="w-4 h-4 text-purple-500" />;
      case 'traffic': return <Activity className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-cyan-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs select-none font-sans animate-in fade-in duration-150">
      <div
        className="w-[420px] h-full shadow-2xl border-l flex flex-col bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                Notifications
                {unreadCount() > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white">
                    {unreadCount()} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-gray-500">Updates, system advisories &amp; bridge activity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar & Quick Actions */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-1">
            {(['all', 'unread', 'update', 'security'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={markAllAsRead}
              className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearNotifications}
              className="p-1.5 rounded-lg text-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <Bell className="w-10 h-10 mb-2 opacity-30" />
              <div className="text-xs font-semibold">No notifications found</div>
              <div className="text-[11px] text-gray-500 mt-1">You are completely up to date.</div>
            </div>
          ) : (
            filteredList.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  !n.read
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-500/30 shadow-xs'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 opacity-80 hover:opacity-100'
                }`}
              >
                {!n.read && (
                  <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-emerald-500" />
                )}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-bold text-xs text-gray-900 dark:text-gray-100">{n.title}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{n.message}</div>
                    {n.actionUrl && (
                      <a
                        href={n.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{n.actionLabel || 'Learn More'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="text-[10px] text-gray-400 mt-2">
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
