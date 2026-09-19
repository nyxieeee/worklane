import React, { useMemo } from 'react';
import { Bell, Clock, AlertTriangle, CheckCircle2, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifStore } from '../store/useNotifStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatTime } from '../utils';

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock size={14} color="#f59e0b" />,
  alert: <AlertTriangle size={14} color="#ef4444" />,
  bell:  <Bell size={14} color="#3b82f6" />,
  check: <CheckCircle2 size={14} color="#10b981" />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenCard: (cardId: string, boardId: string) => void;
}

export default function NotifPanel({ open, onClose, onOpenCard }: Props) {
  const rawNotifications = useNotifStore(s => s.notifications);
  const clearAll         = useNotifStore(s => s.clearAll);
  const removeNotification = useNotifStore(s => s.removeNotification);
  const user             = useAuthStore(s => s.user);

  const notifications = useMemo(() => {
    if (!user?.email) return rawNotifications.filter(n => !n.recipientEmail);
    const email = user.email.toLowerCase().trim();
    return rawNotifications.filter(n => !n.recipientEmail || n.recipientEmail === email);
  }, [rawNotifications, user?.email]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          backgroundColor: 'transparent'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            top: 56,
            right: 20,
            width: 350,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 460,
            backgroundColor: 'hsl(var(--card))',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--neu-shadow-floating)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid hsl(var(--border) / 0.6)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Panel Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={14} color="hsl(var(--primary))" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Notifications</span>
              {notifications.length > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 10, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                  {notifications.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {notifications.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '2px 8px', color: 'hsl(var(--destructive))', height: 26 }}
                  onClick={() => {
                    clearAll(user?.email);
                    onClose();
                  }}
                  title="Clear all notifications and close"
                >
                  Clear all
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={onClose}
                title="Close notifications"
              >
                <X size={13} />
              </motion.button>
            </div>
          </div>

          {/* Notifications List */}
          <div style={{ padding: '8px 12px 12px 12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: 'hsl(var(--primary))' }} />
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>All caught up!</div>
              </div>
            ) : (
              notifications.map(n => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '9px 11px',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    cursor: (n.boardId && n.cardId) ? 'pointer' : 'default',
                    position: 'relative',
                    whiteSpace: 'normal',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => {
                    if (n.boardId && n.cardId) {
                      onOpenCard(n.cardId, n.boardId);
                      onClose();
                    }
                  }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {iconMap[n.icon] ?? <Bell size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                    }}>
                      {n.title}
                    </div>
                    <div style={{
                      fontSize: 11.5,
                      color: 'hsl(var(--muted-foreground))',
                      marginTop: 2,
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                    }}>
                      {n.sub}
                    </div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground) / 0.8)', marginTop: 4 }}>
                      {formatTime(n.time)}
                    </div>
                  </div>
                  {/* Individual Close / Dismiss Button */}
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    type="button"
                    className="icon-btn"
                    style={{
                      width: 20,
                      height: 20,
                      minWidth: 20,
                      minHeight: 20,
                      padding: 0,
                      borderRadius: 4,
                      color: 'hsl(var(--muted-foreground))',
                      flexShrink: 0,
                      marginLeft: 4,
                      marginTop: 1,
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(n.id);
                    }}
                    title="Dismiss notification"
                  >
                    <X size={12} />
                  </motion.button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
