import { create } from 'zustand';
import { logAnalyticsEvent } from '../services/firebase';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'update' | 'security' | 'traffic' | 'system' | 'info';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'HTTPeek v2.5.0 Release',
    message: 'Added full HTTP/3 (QUIC), WebSocket streaming, Visual Rule Studios, and Reqable-grade badge color coding.',
    type: 'update',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
    actionUrl: 'https://github.com/Arslan10227/HTTPeek/releases',
    actionLabel: 'View Release',
  },
  {
    id: 'notif-2',
    title: 'Subresource Integrity (SRI) Passthrough Active',
    message: 'Raw byte-for-byte stream passthrough enabled to guarantee 100% compatibility with DeepSeek, ChatGPT, and Copilot.',
    type: 'security',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Visual Rule Studio Enabled',
    message: 'All Rewrite, Breakpoint, Throttling, and DNS Host mapping dialogs are now 100% visual with 1-click presets.',
    type: 'system',
    timestamp: new Date(Date.now() - 1000 * 60 * 360),
    read: true,
  },
];

interface NotificationState {
  notifications: AppNotification[];
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  clearNotifications: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: INITIAL_NOTIFICATIONS,
  isDrawerOpen: false,

  openDrawer: () => {
    set({ isDrawerOpen: true });
    logAnalyticsEvent('notifications_opened');
  },
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => {
    const next = !get().isDrawerOpen;
    set({ isDrawerOpen: next });
    if (next) logAnalyticsEvent('notifications_opened');
  },

  markAsRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  addNotification: (n) => {
    const newNotif: AppNotification = {
      ...n,
      id: `notif-${Date.now()}`,
      timestamp: new Date(),
      read: false,
    };
    set((state) => ({
      notifications: [newNotif, ...state.notifications],
    }));
    logAnalyticsEvent('notification_received', { title: n.title, type: n.type });
  },

  clearNotifications: () => set({ notifications: [] }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
