import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, LogOut, AlertTriangle, Info, X } from 'lucide-react';
import { useConfirmStore } from '../../store/useConfirmStore';

export default function ConfirmModal() {
  const { config, isOpen, closeConfirm } = useConfirmStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        config?.onCancel?.();
        closeConfirm();
      } else if (e.key === 'Enter') {
        config?.onConfirm();
        closeConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, config, closeConfirm]);

  if (!isOpen || !config) return null;

  const isDanger = config.variant === 'danger' || !config.variant;
  const isWarning = config.variant === 'warning';

  const renderIcon = () => {
    if (config.icon === 'logout') {
      return (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: 'hsl(var(--destructive) / 0.12)',
            color: 'hsl(var(--destructive))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <LogOut size={22} />
        </div>
      );
    }
    if (config.icon === 'alert' || isWarning) {
      return (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: 'hsl(var(--warning, 38 92% 50%) / 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={22} />
        </div>
      );
    }
    if (config.icon === 'info') {
      return (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: 'hsl(var(--primary) / 0.15)',
            color: 'hsl(var(--primary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Info size={22} />
        </div>
      );
    }

    // Default danger/trash icon
    return (
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: 'hsl(var(--destructive) / 0.12)',
          color: 'hsl(var(--destructive))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Trash2 size={22} />
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 20,
        }}
        onClick={() => {
          config.onCancel?.();
          closeConfirm();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="modal"
          style={{
            maxWidth: 420,
            width: '100%',
            backgroundColor: 'hsl(var(--card))',
            borderRadius: 18,
            boxShadow: 'var(--neu-shadow-floating), 0 24px 48px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid hsl(var(--border) / 0.6)',
            padding: 0,
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '24px 24px 16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {renderIcon()}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'hsl(var(--foreground))',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {config.title || (isDanger ? 'Are you sure?' : 'Confirm Action')}
                </h3>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  className="icon-btn"
                  style={{ width: 26, height: 26, marginTop: -4, marginRight: -4 }}
                  onClick={() => {
                    config.onCancel?.();
                    closeConfirm();
                  }}
                >
                  <X size={14} />
                </motion.button>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'hsl(var(--muted-foreground))',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {config.message}
              </p>
            </div>
          </div>

          <div
            style={{
              padding: '14px 24px 20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              backgroundColor: 'hsl(var(--card))',
              borderTop: '1px solid hsl(var(--border) / 0.3)',
            }}
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12.5, padding: '7px 16px' }}
              onClick={() => {
                config.onCancel?.();
                closeConfirm();
              }}
            >
              {config.cancelText || 'Cancel'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className="btn"
              style={{
                fontSize: 12.5,
                padding: '7px 18px',
                fontWeight: 600,
                backgroundColor: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : 'hsl(var(--primary))',
                color: '#ffffff',
                border: 'none',
                boxShadow: isDanger
                  ? '0 2px 8px rgba(239, 68, 68, 0.4)'
                  : 'var(--neu-shadow-raised-sm)',
                cursor: 'pointer',
              }}
              onClick={() => {
                config.onConfirm();
                closeConfirm();
              }}
            >
              {config.confirmText || (isDanger ? 'Delete' : 'Confirm')}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
