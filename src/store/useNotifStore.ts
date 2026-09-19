import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification } from '../types';
import { uid } from '../utils';
import { supabaseService } from '../services/supabaseService';

interface NotifState {
  notifications: Notification[];
  loadNotificationsFromCloud: (userEmail: string) => Promise<void>;
  addNotification: (
    title: string,
    sub: string,
    icon?: string,
    cardId?: string | null,
    boardId?: string | null,
    recipientEmail?: string | null
  ) => void;
  getNotificationsForUser: (userEmail?: string) => Notification[];
  removeNotification: (id: string) => void;
  clearAll: (userEmail?: string) => void;
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set, get) => ({
      notifications: [],

      loadNotificationsFromCloud: async (userEmail: string) => {
        if (!userEmail || !supabaseService.isConfigured()) return;
        const cleanEmail = userEmail.toLowerCase().trim();
        try {
          const cloudNotifs = await supabaseService.getNotificationsForUser(cleanEmail);
          set(s => {
            const map = new Map<string, Notification>();
            // Keep existing local notifs
            s.notifications.forEach(n => map.set(n.id, n));
            // Merge cloud notifs
            cloudNotifs.forEach(n => map.set(n.id, n));
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
            );
            return { notifications: merged.slice(0, 50) };
          });
        } catch (err) {
          console.warn('[useNotifStore] Error loading cloud notifications:', err);
        }
      },

      addNotification: (title, sub, icon = 'bell', cardId = null, boardId = null, recipientEmail = null) => {
        const cleanRecipient = recipientEmail ? recipientEmail.toLowerCase().trim() : null;
        const notif: Notification = {
          id: uid(),
          title,
          sub,
          icon,
          cardId,
          boardId,
          recipientEmail: cleanRecipient,
          time: new Date().toISOString(),
        };

        // If this notification is for the current recipient or broadcast, store locally
        set(s => {
          const notifications = [notif, ...s.notifications].slice(0, 50);
          return { notifications };
        });

        // Send to cloud database so recipient's device receives it in real-time
        if (cleanRecipient) {
          supabaseService.createNotification(notif);
        }

        // Trigger native browser notification if allowed
        if (Notification.permission === 'granted') {
          try {
            new Notification(`Worklane: ${title}`, { body: sub });
          } catch (e) {
            // ignore
          }
        }
      },

      getNotificationsForUser: (userEmail) => {
        const { notifications } = get();
        if (!userEmail) return notifications.filter(n => !n.recipientEmail);
        const email = userEmail.toLowerCase().trim();
        return notifications.filter(n => !n.recipientEmail || n.recipientEmail === email);
      },

      removeNotification: (id: string) => {
        set(s => ({
          notifications: s.notifications.filter(n => n.id !== id)
        }));
        if (supabaseService.isConfigured()) {
          supabaseService.deleteNotification(id);
        }
      },

      clearAll: (userEmail) => {
        if (!userEmail) {
          set({ notifications: [] });
          return;
        }
        const email = userEmail.toLowerCase().trim();
        set(s => ({
          notifications: s.notifications.filter(n => (n.recipientEmail ? n.recipientEmail !== email : false))
        }));
        supabaseService.clearNotifications(email);
      },
    }),
    { name: 'worklane_notifs_v3' }
  )
);
