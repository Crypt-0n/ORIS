import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, AtSign, MessageCircle, UserPlus, GitBranch, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch (_) { /* ignore */ }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.get('/notifications');
      setNotifications(data as Notification[] || []);
    } catch (_) { /* ignore */ }
    setLoading(false);
  };

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen) fetchNotifications();
    setIsOpen(!isOpen);
  };

  const handleMarkRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await api.put('/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string, wasUnread: boolean) => {
    await api.delete(`/notifications/${id}`);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleDeleteAll = async () => {
    await api.delete('/notifications/all');
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) handleMarkRead(n.id);
    if (n.link) {
      navigate(n.link);
      setIsOpen(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('notifications.justNow');
    if (diffMins < 60) return `${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}j`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign className="w-4 h-4 text-blue-500" />;
      case 'assignment': return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'task_status': return <GitBranch className="w-4 h-4 text-amber-500" />;
      case 'task_comment': return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'case_status': return <GitBranch className="w-4 h-4 text-orange-500" />;
      default: return <MessageCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
        title={t('notifications.title')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {t('notifications.title')}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-500 dark:text-slate-400 hover:text-blue-600"
                  title={t('notifications.markAllRead')}
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Tout supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-500 dark:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
                {t('notifications.loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t('notifications.empty')}
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-slate-800 last:border-0
                    ${n.is_read ? 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0" onClick={() => handleClick(n)}>
                    <p className={`text-sm leading-tight ${n.is_read ? 'text-gray-700 dark:text-slate-300' : 'text-gray-900 dark:text-white font-medium'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">{formatTime(n.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-0.5">
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                        title={t('notifications.markRead')}
                      >
                        <Check className="w-3.5 h-3.5 text-blue-500" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(n.id, !n.is_read); }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                      title={t('notifications.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
